import type { Sql } from "postgres";
import type {
	SchemaInfo,
	TableInfo,
	ColumnInfo,
	ForeignKeyTarget,
	ConstraintInfo,
	IndexInfo,
	TableDetailInfo,
} from "../types";

export class SchemaIntrospection {
	async getSchemas(sql: Sql): Promise<string[]> {
		const rows = await sql`
			SELECT schema_name
			FROM information_schema.schemata
			WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
			  AND schema_name NOT LIKE 'pg_temp_%'
			  AND schema_name NOT LIKE 'pg_toast_temp_%'
			ORDER BY schema_name
		`;
		return rows.map((r) => r.schema_name as string);
	}

	async getTables(sql: Sql, schema: string): Promise<TableInfo[]> {
		const rows = await sql`
			SELECT table_name, table_type
			FROM information_schema.tables
			WHERE table_schema = ${schema}
			  AND table_type IN ('BASE TABLE', 'VIEW')
			ORDER BY table_name
		`;
		return rows.map((r) => ({
			schema,
			name: r.table_name as string,
			type: r.table_type as "BASE TABLE" | "VIEW",
			columns: [],
		}));
	}

	async getColumns(
		sql: Sql,
		schema: string,
		table: string
	): Promise<ColumnInfo[]> {
		const rows = await sql`
			SELECT
				c.column_name,
				c.data_type,
				c.is_nullable,
				c.column_default,
				c.ordinal_position,
				c.character_maximum_length,
				c.numeric_precision,
				c.numeric_scale,
				c.udt_name,
				CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_primary_key
			FROM information_schema.columns c
			LEFT JOIN (
				SELECT kcu.column_name
				FROM information_schema.table_constraints tc
				JOIN information_schema.key_column_usage kcu
					ON tc.constraint_name = kcu.constraint_name
					AND tc.table_schema = kcu.table_schema
				WHERE tc.constraint_type = 'PRIMARY KEY'
					AND tc.table_schema = ${schema}
					AND tc.table_name = ${table}
			) pk ON pk.column_name = c.column_name
			WHERE c.table_schema = ${schema}
			  AND c.table_name = ${table}
			ORDER BY c.ordinal_position
		`;
		return rows.map((r) => ({
			name: r.column_name as string,
			dataType: r.data_type as string,
			isNullable: r.is_nullable === "YES",
			columnDefault: r.column_default as string | null,
			isPrimaryKey: r.is_primary_key as boolean,
			ordinalPosition: r.ordinal_position as number,
			characterMaximumLength: r.character_maximum_length as number | null,
			numericPrecision: r.numeric_precision as number | null,
			numericScale: r.numeric_scale as number | null,
			udtName: r.udt_name as string,
			enumValues: null,
			isForeignKey: false,
			foreignKeyTarget: null,
		}));
	}

	async getEnumValues(sql: Sql, typeName: string): Promise<string[]> {
		const rows = await sql`
			SELECT e.enumlabel
			FROM pg_type t
			JOIN pg_enum e ON e.enumtypid = t.oid
			WHERE t.typname = ${typeName}
			ORDER BY e.enumsortorder
		`;
		return rows.map((r) => r.enumlabel as string);
	}

	async getForeignKeys(
		sql: Sql,
		schema: string,
		table: string
	): Promise<Map<string, ForeignKeyTarget>> {
		const rows = await sql`
			SELECT
				kcu.column_name,
				ccu.table_schema AS foreign_schema,
				ccu.table_name AS foreign_table,
				ccu.column_name AS foreign_column
			FROM information_schema.table_constraints tc
			JOIN information_schema.key_column_usage kcu
				ON tc.constraint_name = kcu.constraint_name
				AND tc.table_schema = kcu.table_schema
			JOIN information_schema.constraint_column_usage ccu
				ON tc.constraint_name = ccu.constraint_name
				AND tc.table_schema = ccu.table_schema
			WHERE tc.constraint_type = 'FOREIGN KEY'
				AND tc.table_schema = ${schema}
				AND tc.table_name = ${table}
		`;
		const map = new Map<string, ForeignKeyTarget>();
		for (const r of rows) {
			map.set(r.column_name as string, {
				schema: r.foreign_schema as string,
				table: r.foreign_table as string,
				column: r.foreign_column as string,
			});
		}
		return map;
	}

	async getConstraints(
		sql: Sql,
		schema: string,
		table: string
	): Promise<ConstraintInfo[]> {
		const rows = await sql`
			SELECT
				tc.constraint_name,
				tc.constraint_type,
				array_agg(DISTINCT kcu.column_name ORDER BY kcu.column_name) AS columns,
				pg_get_constraintdef(pgc.oid) AS definition,
				ccu.table_schema AS foreign_schema,
				ccu.table_name AS foreign_table,
				array_agg(DISTINCT ccu.column_name ORDER BY ccu.column_name) FILTER (WHERE tc.constraint_type = 'FOREIGN KEY') AS foreign_columns
			FROM information_schema.table_constraints tc
			JOIN information_schema.key_column_usage kcu
				ON tc.constraint_name = kcu.constraint_name
				AND tc.table_schema = kcu.table_schema
			LEFT JOIN information_schema.constraint_column_usage ccu
				ON tc.constraint_name = ccu.constraint_name
				AND tc.table_schema = ccu.table_schema
				AND tc.constraint_type = 'FOREIGN KEY'
			LEFT JOIN pg_constraint pgc
				ON pgc.conname = tc.constraint_name
				AND pgc.connamespace = (SELECT oid FROM pg_namespace WHERE nspname = tc.table_schema)
			WHERE tc.table_schema = ${schema}
				AND tc.table_name = ${table}
			GROUP BY tc.constraint_name, tc.constraint_type, pgc.oid, ccu.table_schema, ccu.table_name
			ORDER BY tc.constraint_type, tc.constraint_name
		`;
		return rows.map((r) => ({
			name: r.constraint_name as string,
			type: r.constraint_type as string,
			columns: r.columns as string[],
			definition: r.definition as string | undefined,
			foreignSchema: r.foreign_schema as string | undefined,
			foreignTable: r.foreign_table as string | undefined,
			foreignColumns: r.foreign_columns as string[] | undefined,
		}));
	}

	async getIndexes(
		sql: Sql,
		schema: string,
		table: string
	): Promise<IndexInfo[]> {
		const rows = await sql`
			SELECT
				i.relname AS index_name,
				array_agg(a.attname ORDER BY x.ordering) AS columns,
				ix.indisunique AS is_unique,
				ix.indisprimary AS is_primary,
				am.amname AS index_type,
				pg_get_indexdef(ix.indexrelid) AS definition
			FROM pg_index ix
			JOIN pg_class t ON t.oid = ix.indrelid
			JOIN pg_class i ON i.oid = ix.indexrelid
			JOIN pg_namespace n ON n.oid = t.relnamespace
			JOIN pg_am am ON am.oid = i.relam
			JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS x(attnum, ordering) ON true
			JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = x.attnum
			WHERE n.nspname = ${schema}
				AND t.relname = ${table}
			GROUP BY i.relname, ix.indisunique, ix.indisprimary, am.amname, ix.indexrelid
			ORDER BY ix.indisprimary DESC, i.relname
		`;
		return rows.map((r) => ({
			name: r.index_name as string,
			columns: r.columns as string[],
			isUnique: r.is_unique as boolean,
			isPrimary: r.is_primary as boolean,
			indexType: r.index_type as string,
			definition: r.definition as string,
		}));
	}

	async getTableDetail(
		sql: Sql,
		schema: string,
		table: string
	): Promise<TableDetailInfo> {
		const [columns, fkMap, constraints, indexes, rowCountResult] =
			await Promise.all([
				this.getColumns(sql, schema, table),
				this.getForeignKeys(sql, schema, table),
				this.getConstraints(sql, schema, table),
				this.getIndexes(sql, schema, table),
				sql`
				SELECT reltuples::bigint AS estimate
				FROM pg_class c
				JOIN pg_namespace n ON n.oid = c.relnamespace
				WHERE n.nspname = ${schema} AND c.relname = ${table}
			`,
			]);

		// Enrich columns with FK info
		for (const col of columns) {
			const fk = fkMap.get(col.name);
			if (fk) {
				col.isForeignKey = true;
				col.foreignKeyTarget = fk;
			}
		}

		// Enrich columns with enum values for USER-DEFINED types
		const enumPromises: Promise<void>[] = [];
		for (const col of columns) {
			if (col.dataType === "USER-DEFINED") {
				enumPromises.push(
					this.getEnumValues(sql, col.udtName).then((values) => {
						if (values.length > 0) {
							col.enumValues = values;
						}
					})
				);
			}
		}
		await Promise.all(enumPromises);

		const estimatedRowCount =
			rowCountResult.length > 0
				? Math.max(0, Number(rowCountResult[0].estimate))
				: 0;

		return {
			schema,
			table,
			columns,
			constraints,
			indexes,
			estimatedRowCount,
		};
	}

	async getSchemaTree(sql: Sql): Promise<SchemaInfo[]> {
		const schemas = await this.getSchemas(sql);
		const tree: SchemaInfo[] = [];

		for (const schemaName of schemas) {
			const tables = await this.getTables(sql, schemaName);
			tree.push({ name: schemaName, tables });
		}

		return tree;
	}
}

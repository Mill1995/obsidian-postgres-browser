import type { Sql } from "postgres";
import type { SchemaInfo, TableInfo, ColumnInfo } from "../types";

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
		}));
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

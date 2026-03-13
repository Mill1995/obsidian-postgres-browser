import type { Sql } from "postgres";
import type { QueryResult } from "../types";
import { quoteIdent } from "./sql-utils";

export class QueryExecutor {
	async execute(
		sql: Sql,
		queryText: string,
		timeoutSeconds: number
	): Promise<QueryResult> {
		const start = performance.now();
		const timeoutMs = Math.max(1, Math.round(timeoutSeconds)) * 1000;

		try {
			await sql.unsafe(`SET statement_timeout = $1`, [timeoutMs]);
			try {
				const result = await sql.unsafe(queryText);
				const duration = performance.now() - start;

				const columns =
					result.length > 0
						? Object.keys(result[0])
						: result.columns?.map(
								(c: { name: string }) => c.name
							) ?? [];

				return {
					columns,
					rows: result as Record<string, unknown>[],
					rowCount: result.count ?? result.length,
					duration: Math.round(duration),
					command: result.command ?? "UNKNOWN",
				};
			} finally {
				await sql.unsafe("SET statement_timeout = $1", [0]).catch(() => {});
			}
		} catch (err: unknown) {
			throw this.normalizeError(err);
		}
	}

	async previewTable(
		sql: Sql,
		schema: string,
		table: string,
		limit: number
	): Promise<QueryResult> {
		const start = performance.now();
		const result = await sql.unsafe(
			`SELECT * FROM ${quoteIdent(schema)}.${quoteIdent(table)} LIMIT $1`,
			[limit]
		);
		const duration = performance.now() - start;

		const columns =
			result.length > 0
				? Object.keys(result[0])
				: result.columns?.map((c: { name: string }) => c.name) ?? [];

		return {
			columns,
			rows: result as Record<string, unknown>[],
			rowCount: result.count ?? result.length,
			duration: Math.round(duration),
			command: "SELECT",
		};
	}

	async updateCell(
		sql: Sql,
		schema: string,
		table: string,
		pkColumns: { name: string; value: unknown }[],
		targetColumn: string,
		newValue: unknown
	): Promise<void> {
		if (pkColumns.length === 0) {
			throw new Error("Cannot update: no primary key columns provided");
		}

		const setCols = `${quoteIdent(targetColumn)} = $1`;
		const whereParts = pkColumns.map(
			(_, i) => `${quoteIdent(pkColumns[i].name)} = $${i + 2}`
		);
		const whereClause = whereParts.join(" AND ");
		const query = `UPDATE ${quoteIdent(schema)}.${quoteIdent(table)} SET ${setCols} WHERE ${whereClause}`;
		const params = [newValue, ...pkColumns.map((pk) => pk.value)];

		const result = await sql.unsafe(query, params as never[]);
		const count = result.count ?? 0;

		if (count === 0) {
			throw new Error(
				"No rows updated. The row may have been deleted or modified."
			);
		}
		if (count > 1) {
			throw new Error(
				`Unexpected: ${count} rows were updated instead of 1.`
			);
		}
	}

	async deleteRow(
		sql: Sql,
		schema: string,
		table: string,
		pkColumns: { name: string; value: unknown }[]
	): Promise<void> {
		if (pkColumns.length === 0) {
			throw new Error("Cannot delete: no primary key columns provided");
		}

		const whereParts = pkColumns.map(
			(_, i) => `${quoteIdent(pkColumns[i].name)} = $${i + 1}`
		);
		const query = `DELETE FROM ${quoteIdent(schema)}.${quoteIdent(table)} WHERE ${whereParts.join(" AND ")}`;
		const params = pkColumns.map((pk) => pk.value);

		const result = await sql.unsafe(query, params as never[]);
		const count = result.count ?? 0;

		if (count === 0) {
			throw new Error(
				"No rows deleted. The row may have already been deleted."
			);
		}
	}

	private normalizeError(err: unknown): Error {
		if (err instanceof Error) {
			const pgErr = err as unknown as Record<string, unknown>;
			return Object.assign(new Error(pgErr.message as string), {
				code: pgErr.code as string | undefined,
				detail: pgErr.detail as string | undefined,
				hint: pgErr.hint as string | undefined,
				position: pgErr.position as string | undefined,
			});
		}
		return new Error(String(err));
	}
}

import type { Sql } from "postgres";
import type { QueryResult, QueryError } from "../types";

export class QueryExecutor {
	async execute(
		sql: Sql,
		queryText: string,
		_timeoutSeconds: number
	): Promise<QueryResult> {
		const start = performance.now();

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
			`SELECT * FROM "${schema}"."${table}" LIMIT ${limit}`
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

	private normalizeError(err: unknown): QueryError {
		if (err instanceof Error) {
			const pgErr = err as unknown as Record<string, unknown>;
			return {
				message: pgErr.message as string,
				code: pgErr.code as string | undefined,
				detail: pgErr.detail as string | undefined,
				hint: pgErr.hint as string | undefined,
				position: pgErr.position as string | undefined,
			};
		}
		return { message: String(err) };
	}
}

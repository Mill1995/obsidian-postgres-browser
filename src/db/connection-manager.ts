import postgres, { Sql } from "postgres";
import type { ConnectionConfig } from "../types";
import { quoteIdent } from "./sql-utils";

interface CachedConnection {
	sql: Sql;
	connectionString: string;
}

function isLoopbackHost(connectionString: string): boolean {
	return /localhost|127\.0\.0\.1|::1/.test(connectionString);
}

/**
 * Strip Prisma's `?schema=X` from a connection string and return the cleaned
 * string plus the extracted schema (if any). The `schema` query param is not a
 * standard PostgreSQL parameter — passing it through causes the library to set
 * an unknown session variable, which PostgreSQL rejects.
 */
export function parseConnectionString(raw: string): {
	connectionString: string;
	schema: string | undefined;
} {
	let schema: string | undefined;

	try {
		const url = new URL(raw);
		if (url.searchParams.has("schema")) {
			schema = url.searchParams.get("schema") ?? undefined;
			url.searchParams.delete("schema");
		}
		return { connectionString: url.toString(), schema };
	} catch {
		// Not a valid URL — return as-is
		return { connectionString: raw, schema: undefined };
	}
}

export class ConnectionManager {
	private connections: Map<string, CachedConnection> = new Map();

	async getConnection(config: ConnectionConfig): Promise<Sql> {
		const { connectionString: cleanedStr, schema } =
			parseConnectionString(config.connectionString);

		const existing = this.connections.get(config.id);
		if (existing) {
			// If the connection string changed, tear down the stale connection
			if (existing.connectionString !== config.connectionString) {
				try {
					await existing.sql.end({ timeout: 5 });
				} catch {
					// Swallow errors during cleanup
				}
				this.connections.delete(config.id);
			} else {
				return existing.sql;
			}
		}

		const isLocalhost = isLoopbackHost(cleanedStr);

		const sql = postgres(cleanedStr, {
			max: 3,
			idle_timeout: 300,
			connect_timeout: 10,
			ssl: config.ssl ?? (isLocalhost ? false : "require"),
			prepare: true,
		});

		// If a schema was extracted from the connection string, set search_path
		const effectiveSchema = config.schema ?? schema;
		if (effectiveSchema) {
			await sql.unsafe(`SET search_path TO ${quoteIdent(effectiveSchema)}, public`);
		}

		this.connections.set(config.id, {
			sql,
			connectionString: config.connectionString,
		});
		return sql;
	}

	async testConnection(config: ConnectionConfig): Promise<boolean> {
		const { connectionString: cleanedStr } = parseConnectionString(
			config.connectionString
		);

		const isLocalhost = isLoopbackHost(cleanedStr);

		const sql = postgres(cleanedStr, {
			max: 1,
			connect_timeout: 10,
			idle_timeout: 5,
			ssl: config.ssl ?? (isLocalhost ? false : "require"),
		});

		try {
			await sql`SELECT 1 as ok`;
			return true;
		} finally {
			await sql.end({ timeout: 5 });
		}
	}

	async disconnect(connectionId: string): Promise<void> {
		const cached = this.connections.get(connectionId);
		if (cached) {
			await cached.sql.end({ timeout: 5 });
			this.connections.delete(connectionId);
		}
	}

	async disconnectAll(): Promise<void> {
		const promises = Array.from(this.connections.entries()).map(
			async ([id, cached]) => {
				try {
					await cached.sql.end({ timeout: 5 });
				} catch {
					// Swallow errors during cleanup
				}
				this.connections.delete(id);
			}
		);
		await Promise.allSettled(promises);
	}
}

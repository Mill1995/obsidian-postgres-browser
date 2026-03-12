/** Escape a SQL identifier (PostgreSQL double-quote convention). */
export function quoteIdent(name: string): string {
	return `"${name.replace(/"/g, '""')}"`;
}

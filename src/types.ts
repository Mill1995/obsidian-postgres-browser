export interface ConnectionConfig {
	id: string;
	name: string;
	connectionString: string;
	ssl?: boolean | "prefer" | "require";
	schema?: string;
}

export interface PluginSettings {
	connections: ConnectionConfig[];
	activeConnectionId: string | null;
	previewRowLimit: number;
	queryTimeoutSeconds: number;
}

export interface SchemaInfo {
	name: string;
	tables: TableInfo[];
}

export interface TableInfo {
	schema: string;
	name: string;
	type: "BASE TABLE" | "VIEW";
	columns: ColumnInfo[];
}

export interface ColumnInfo {
	name: string;
	dataType: string;
	isNullable: boolean;
	columnDefault: string | null;
	isPrimaryKey: boolean;
	ordinalPosition: number;
}

export interface QueryResult {
	columns: string[];
	rows: Record<string, unknown>[];
	rowCount: number;
	duration: number;
	command: string;
}

export interface QueryError {
	message: string;
	code?: string;
	detail?: string;
	hint?: string;
	position?: string;
}

export type ViewMode = "data" | "query";

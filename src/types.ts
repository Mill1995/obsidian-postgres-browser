export interface ConnectionConfig {
	id: string;
	name: string;
	connectionString: string;
	ssl?: boolean | "prefer" | "require";
	schema?: string;
	isSecured?: boolean;
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
	characterMaximumLength: number | null;
	numericPrecision: number | null;
	numericScale: number | null;
	udtName: string;
	enumValues: string[] | null;
	isForeignKey: boolean;
	foreignKeyTarget: ForeignKeyTarget | null;
}

export interface ForeignKeyTarget {
	schema: string;
	table: string;
	column: string;
}

export interface ConstraintInfo {
	name: string;
	type: string;
	columns: string[];
	definition?: string;
	foreignSchema?: string;
	foreignTable?: string;
	foreignColumns?: string[];
}

export interface IndexInfo {
	name: string;
	columns: string[];
	isUnique: boolean;
	isPrimary: boolean;
	indexType: string;
	definition: string;
}

export interface TableDetailInfo {
	schema: string;
	table: string;
	columns: ColumnInfo[];
	constraints: ConstraintInfo[];
	indexes: IndexInfo[];
	estimatedRowCount: number;
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

export type ViewMode = "data" | "query" | "schema";

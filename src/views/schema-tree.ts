import { setIcon } from "obsidian";
import type PostgresBrowserPlugin from "../main";
import type { SchemaInfo, TableInfo, ColumnInfo } from "../types";

export class SchemaTree {
	private container: HTMLElement;
	private plugin: PostgresBrowserPlugin;
	private onTableSelect: (schema: string, table: string) => void;
	private schemaData: SchemaInfo[] = [];

	constructor(
		container: HTMLElement,
		plugin: PostgresBrowserPlugin,
		onTableSelect: (schema: string, table: string) => void
	) {
		this.container = container;
		this.plugin = plugin;
		this.onTableSelect = onTableSelect;
	}

	setData(data: SchemaInfo[]): void {
		this.schemaData = data;
		this.render();
	}

	showLoading(): void {
		this.container.empty();
		this.container.createEl("p", {
			text: "Loading schemas...",
			cls: "pg-muted",
		});
	}

	showError(message: string): void {
		this.container.empty();
		const errorEl = this.container.createDiv({ cls: "pg-error" });
		errorEl.createEl("p", { text: message });
	}

	showEmpty(): void {
		this.container.empty();
		this.container.createEl("p", {
			text: "Select a connection above.",
			cls: "pg-muted",
		});
	}

	private render(): void {
		this.container.empty();

		if (this.schemaData.length === 0) {
			this.container.createEl("p", {
				text: "No schemas found.",
				cls: "pg-muted",
			});
			return;
		}

		const treeEl = this.container.createDiv({ cls: "pg-tree" });

		for (const schema of this.schemaData) {
			this.renderSchemaNode(treeEl, schema);
		}
	}

	private renderSchemaNode(parent: HTMLElement, schema: SchemaInfo): void {
		const schemaEl = parent.createDiv({
			cls: "pg-tree-node pg-schema-node",
		});
		const header = schemaEl.createDiv({ cls: "pg-tree-header" });

		const collapseIcon = header.createSpan({ cls: "pg-collapse-icon" });
		setIcon(collapseIcon, "chevron-right");

		header.createSpan({ text: schema.name, cls: "pg-schema-name" });
		header.createSpan({
			text: `(${schema.tables.length})`,
			cls: "pg-count-badge",
		});

		const childrenEl = schemaEl.createDiv({
			cls: "pg-tree-children pg-hidden",
		});

		header.addEventListener("click", () => {
			const isHidden = childrenEl.hasClass("pg-hidden");
			childrenEl.toggleClass("pg-hidden", !isHidden);
			setIcon(
				collapseIcon,
				isHidden ? "chevron-down" : "chevron-right"
			);
		});

		for (const table of schema.tables) {
			this.renderTableNode(childrenEl, schema.name, table);
		}
	}

	private renderTableNode(
		parent: HTMLElement,
		schemaName: string,
		table: TableInfo
	): void {
		const tableEl = parent.createDiv({
			cls: "pg-tree-node pg-table-node",
		});
		const header = tableEl.createDiv({ cls: "pg-tree-header" });

		const collapseIcon = header.createSpan({ cls: "pg-collapse-icon" });
		setIcon(collapseIcon, "chevron-right");

		const tableIcon = header.createSpan({ cls: "pg-table-icon" });
		setIcon(tableIcon, table.type === "VIEW" ? "eye" : "table");

		header.createSpan({ text: table.name, cls: "pg-table-name" });

		const childrenEl = tableEl.createDiv({
			cls: "pg-tree-children pg-hidden",
		});

		header.addEventListener("click", async () => {
			this.onTableSelect(schemaName, table.name);

			if (table.columns.length === 0) {
				const activeConn = this.getActiveConfig();
				if (activeConn) {
					try {
						const sql =
							await this.plugin.connectionManager.getConnection(
								activeConn
							);
						table.columns =
							await this.plugin.schemaIntrospection.getColumns(
								sql,
								schemaName,
								table.name
							);
						this.renderColumns(childrenEl, table.columns);
					} catch {
						childrenEl.empty();
						childrenEl.createEl("p", {
							text: "Failed to load columns.",
							cls: "pg-muted",
						});
					}
				}
			}

			const isHidden = childrenEl.hasClass("pg-hidden");
			childrenEl.toggleClass("pg-hidden", !isHidden);
			setIcon(
				collapseIcon,
				isHidden ? "chevron-down" : "chevron-right"
			);
		});
	}

	private renderColumns(parent: HTMLElement, columns: ColumnInfo[]): void {
		parent.empty();
		for (const col of columns) {
			const colEl = parent.createDiv({ cls: "pg-column-node" });
			const nullable = col.isNullable ? "?" : "";
			const pkBadge = col.isPrimaryKey ? " PK" : "";
			colEl.createSpan({
				text: `${col.name} (${col.dataType}${nullable})${pkBadge}`,
				cls: col.isPrimaryKey ? "pg-column-pk" : "pg-column",
			});
		}
	}

	private getActiveConfig() {
		const id = this.plugin.settings.activeConnectionId;
		if (!id) return null;
		return this.plugin.settings.connections.find((c) => c.id === id) ?? null;
	}
}

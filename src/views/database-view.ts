import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import type PostgresBrowserPlugin from "../main";
import { VIEW_TYPE_PG_BROWSER } from "../constants";
import type { QueryError, ViewMode } from "../types";
import { Toolbar } from "./toolbar";
import { SchemaTree } from "./schema-tree";
import { DataView } from "./data-view";
import { QueryView } from "./query-view";
import { SchemaDetailView } from "./schema-detail-view";
import { ResizeHandle } from "./resize-handle";

export class PostgresBrowserView extends ItemView {
	plugin: PostgresBrowserPlugin;
	private toolbar!: Toolbar;
	private schemaTree!: SchemaTree;
	private dataView!: DataView;
	private queryView!: QueryView;
	private schemaDetailView!: SchemaDetailView;
	private dataContainer!: HTMLElement;
	private queryContainer!: HTMLElement;
	private schemaContainer!: HTMLElement;
	private currentTable: { schema: string; table: string } | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: PostgresBrowserPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_PG_BROWSER;
	}

	getDisplayText(): string {
		return "PostgreSQL browser";
	}

	getIcon(): string {
		return "database";
	}

	onOpen(): Promise<void> {
		const container = this.contentEl;
		container.empty();
		container.addClass("pg-browser");

		this.buildLayout(container);
		return Promise.resolve();
	}

	onClose(): Promise<void> {
		this.contentEl.empty();
		return Promise.resolve();
	}

	private buildLayout(container: HTMLElement): void {
		// Toolbar
		const toolbarEl = container.createDiv();
		this.toolbar = new Toolbar(
			toolbarEl,
			this.plugin,
			(id) => void this.onConnectionChanged(id),
			() => void this.onRefresh(),
			(mode) => this.switchMode(mode),
			() => void this.onPopout()
		);

		// Body: sidebar | resize handle | main
		const body = container.createDiv({ cls: "pg-body" });

		const sidebar = body.createDiv({ cls: "pg-sidebar" });
		const treeContainer = sidebar.createDiv({ cls: "pg-schema-tree" });
		this.schemaTree = new SchemaTree(
			treeContainer,
			this.plugin,
			(schema, table) => void this.onTableSelected(schema, table)
		);

		if (this.plugin.settings.activeConnectionId) {
			void this.loadSchemaTree();
		} else {
			this.schemaTree.showEmpty();
		}

		// Resize handle
		new ResizeHandle(body, sidebar);

		// Main content area
		const main = body.createDiv({ cls: "pg-main" });

		this.dataContainer = main.createDiv({ cls: "pg-data-container" });
		this.dataView = new DataView(this.dataContainer);

		this.queryContainer = main.createDiv({
			cls: "pg-query-container pg-hidden",
		});
		this.queryView = new QueryView(this.queryContainer, (queryText) =>
			void this.onRunQuery(queryText)
		);

		this.schemaContainer = main.createDiv({
			cls: "pg-schema-container pg-hidden",
		});
		this.schemaDetailView = new SchemaDetailView(this.schemaContainer);

		// Start in data mode
		this.switchMode("data");
	}

	private switchMode(mode: ViewMode): void {
		this.toolbar.setMode(mode);
		this.dataContainer.toggleClass("pg-hidden", mode !== "data");
		this.queryContainer.toggleClass("pg-hidden", mode !== "query");
		this.schemaContainer.toggleClass("pg-hidden", mode !== "schema");

		// Load schema detail when switching to schema tab with a table selected
		if (mode === "schema" && this.currentTable) {
			void this.loadSchemaDetail(
				this.currentTable.schema,
				this.currentTable.table
			);
		}
	}

	private async onConnectionChanged(
		connectionId: string | null
	): Promise<void> {
		if (this.plugin.settings.activeConnectionId) {
			await this.plugin.connectionManager.disconnect(
				this.plugin.settings.activeConnectionId
			);
		}

		this.plugin.settings.activeConnectionId = connectionId;
		await this.plugin.saveSettings();

		this.dataView.clear();
		this.schemaDetailView.clear();
		this.currentTable = null;

		if (connectionId) {
			await this.loadSchemaTree();
		} else {
			this.schemaTree.showEmpty();
			this.toolbar.setConnectionInfo("");
		}
	}

	private async onRefresh(): Promise<void> {
		this.toolbar.connectionSelector.refresh();

		if (this.plugin.settings.activeConnectionId) {
			const id = this.plugin.settings.activeConnectionId;
			await this.plugin.connectionManager.disconnect(id);
			await this.loadSchemaTree();
		}
	}

	private async loadSchemaTree(): Promise<void> {
		const config = this.getActiveConfig();
		if (!config) {
			this.schemaTree.showEmpty();
			this.toolbar.setConnectionInfo("");
			return;
		}

		this.schemaTree.showLoading();

		try {
			const sql =
				await this.plugin.connectionManager.getConnection(config);

			try {
				const [info] =
					await sql`SELECT current_database() AS db, current_user AS usr`;
				this.toolbar.setConnectionInfo(
					`Connected to: ${info.db} (user: ${info.usr})`
				);
			} catch {
				this.toolbar.setConnectionInfo("");
			}

			const tree =
				await this.plugin.schemaIntrospection.getSchemaTree(sql);
			this.schemaTree.setData(tree);
		} catch (err) {
			const message =
				err instanceof Error ? err.message : String(err);
			this.schemaTree.showError(`Failed to connect: ${message}`);
			this.toolbar.setConnectionInfo("");
			new Notice(`Connection failed: ${message}`);
		}
	}

	private async onTableSelected(
		schema: string,
		table: string
	): Promise<void> {
		const config = this.getActiveConfig();
		if (!config) return;

		this.currentTable = { schema, table };

		// Auto-switch to data mode (unless on schema tab)
		const currentMode = this.toolbar.getMode();
		if (currentMode === "query") {
			this.switchMode("data");
		} else if (currentMode === "schema") {
			// Reload schema detail for new table
			void this.loadSchemaDetail(schema, table);
		}

		// Always load data preview
		try {
			const sql =
				await this.plugin.connectionManager.getConnection(config);

			// Fetch data, columns, and row count estimate in parallel
			const [result, detail] = await Promise.all([
				this.plugin.queryExecutor.previewTable(
					sql,
					schema,
					table,
					this.plugin.settings.previewRowLimit
				),
				this.plugin.schemaIntrospection.getTableDetail(
					sql,
					schema,
					table
				),
			]);

			const columnMeta = detail.columns;
			const pkColumns = columnMeta
				.filter((c) => c.isPrimaryKey)
				.map((c) => c.name);

			// Set up editing config
			this.dataView.resultsTable.setEditConfig({
				schema,
				table,
				columnMeta,
				pkColumns,
				onCellUpdate: async (
					column: string,
					newValue: unknown,
					row: Record<string, unknown>
				) => {
					const pkValues = pkColumns.map((pk) => ({
						name: pk,
						value: row[pk],
					}));
					await this.plugin.queryExecutor.updateCell(
						sql,
						schema,
						table,
						pkValues,
						column,
						newValue
					);
				},
				onRowDelete: async (row: Record<string, unknown>) => {
					const pkValues = pkColumns.map((pk) => ({
						name: pk,
						value: row[pk],
					}));
					await this.plugin.queryExecutor.deleteRow(
						sql,
						schema,
						table,
						pkValues
					);
				},
			});

			this.dataView.showTable(
				schema,
				table,
				result,
				columnMeta,
				detail.estimatedRowCount
			);
		} catch (err) {
			const qErr = err as QueryError;
			new Notice(
				`Preview failed: ${qErr.message || String(err)}`
			);
		}
	}

	private async loadSchemaDetail(
		schema: string,
		table: string
	): Promise<void> {
		const config = this.getActiveConfig();
		if (!config) return;

		this.schemaDetailView.showLoading();

		try {
			const sql =
				await this.plugin.connectionManager.getConnection(config);
			const detail =
				await this.plugin.schemaIntrospection.getTableDetail(
					sql,
					schema,
					table
				);
			this.schemaDetailView.showDetail(detail);
		} catch (err) {
			const message =
				err instanceof Error ? err.message : String(err);
			new Notice(`Failed to load schema: ${message}`);
			this.schemaDetailView.showEmpty();
		}
	}

	private async onPopout(): Promise<void> {
		await this.plugin.activateViewInWindow();
	}

	private async onRunQuery(queryText: string): Promise<void> {
		const config = this.getActiveConfig();
		if (!config) {
			new Notice("Please select a connection first.");
			return;
		}

		this.queryView.setLoading(true);
		this.queryView.setStatus("Running...");

		try {
			const sql =
				await this.plugin.connectionManager.getConnection(config);
			const result = await this.plugin.queryExecutor.execute(
				sql,
				queryText,
				this.plugin.settings.queryTimeoutSeconds
			);
			this.queryView.showResult(result);
		} catch (err) {
			const qErr = err as QueryError;
			this.queryView.showError(
				qErr.message ? qErr : { message: String(err) }
			);
		} finally {
			this.queryView.setLoading(false);
		}
	}

	private getActiveConfig() {
		const id = this.plugin.settings.activeConnectionId;
		if (!id) return null;
		return (
			this.plugin.settings.connections.find((c) => c.id === id) ?? null
		);
	}
}

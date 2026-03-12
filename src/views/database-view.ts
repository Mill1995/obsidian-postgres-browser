import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import type PostgresBrowserPlugin from "../main";
import { VIEW_TYPE_PG_BROWSER } from "../constants";
import type { QueryError, ViewMode } from "../types";
import { Toolbar } from "./toolbar";
import { SchemaTree } from "./schema-tree";
import { DataView } from "./data-view";
import { QueryView } from "./query-view";
import { ResizeHandle } from "./resize-handle";

export class PostgresBrowserView extends ItemView {
	plugin: PostgresBrowserPlugin;
	private toolbar!: Toolbar;
	private schemaTree!: SchemaTree;
	private dataView!: DataView;
	private queryView!: QueryView;
	private dataContainer!: HTMLElement;
	private queryContainer!: HTMLElement;

	constructor(leaf: WorkspaceLeaf, plugin: PostgresBrowserPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_PG_BROWSER;
	}

	getDisplayText(): string {
		return "PostgreSQL Browser";
	}

	getIcon(): string {
		return "database";
	}

	async onOpen(): Promise<void> {
		const container = this.contentEl;
		container.empty();
		container.addClass("pg-browser");

		this.buildLayout(container);
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	private buildLayout(container: HTMLElement): void {
		// Toolbar
		const toolbarEl = container.createDiv();
		this.toolbar = new Toolbar(
			toolbarEl,
			this.plugin,
			(id) => this.onConnectionChanged(id),
			() => this.onRefresh(),
			(mode) => this.switchMode(mode)
		);

		// Body: sidebar | resize handle | main
		const body = container.createDiv({ cls: "pg-body" });

		const sidebar = body.createDiv({ cls: "pg-sidebar" });
		const treeContainer = sidebar.createDiv({ cls: "pg-schema-tree" });
		this.schemaTree = new SchemaTree(
			treeContainer,
			this.plugin,
			(schema, table) => this.onTableSelected(schema, table)
		);

		if (this.plugin.settings.activeConnectionId) {
			this.loadSchemaTree();
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
			this.onRunQuery(queryText)
		);

		// Start in data mode
		this.switchMode("data");
	}

	private switchMode(mode: ViewMode): void {
		this.toolbar.setMode(mode);
		this.dataContainer.toggleClass("pg-hidden", mode !== "data");
		this.queryContainer.toggleClass("pg-hidden", mode !== "query");
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

		if (connectionId) {
			await this.loadSchemaTree();
		} else {
			this.schemaTree.showEmpty();
			this.toolbar.setConnectionInfo("");
		}
	}

	private async onRefresh(): Promise<void> {
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

		// Auto-switch to data mode
		this.switchMode("data");

		try {
			const sql =
				await this.plugin.connectionManager.getConnection(config);
			const result = await this.plugin.queryExecutor.previewTable(
				sql,
				schema,
				table,
				this.plugin.settings.previewRowLimit
			);
			this.dataView.showTable(schema, table, result);
		} catch (err) {
			const qErr = err as QueryError;
			new Notice(
				`Preview failed: ${qErr.message || String(err)}`
			);
		}
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

import { Plugin, WorkspaceLeaf } from "obsidian";
import type { PluginSettings } from "./types";
import { DEFAULT_SETTINGS, VIEW_TYPE_PG_BROWSER } from "./constants";
import { PostgresBrowserSettingTab } from "./settings";
import { PostgresBrowserView } from "./views/database-view";
import { ConnectionManager } from "./db/connection-manager";
import { SchemaIntrospection } from "./db/schema-introspection";
import { QueryExecutor } from "./db/query-executor";

export default class PostgresBrowserPlugin extends Plugin {
	settings: PluginSettings = DEFAULT_SETTINGS;
	connectionManager: ConnectionManager = new ConnectionManager();
	schemaIntrospection: SchemaIntrospection = new SchemaIntrospection();
	queryExecutor: QueryExecutor = new QueryExecutor();

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(
			VIEW_TYPE_PG_BROWSER,
			(leaf: WorkspaceLeaf) => new PostgresBrowserView(leaf, this)
		);

		this.addRibbonIcon("database", "Open PostgreSQL Browser", () => {
			this.activateView();
		});

		this.addCommand({
			id: "open-postgres-browser",
			name: "Open PostgreSQL Browser",
			callback: () => this.activateView(),
		});

		this.addSettingTab(new PostgresBrowserSettingTab(this.app, this));
	}

	async onunload(): Promise<void> {
		await this.connectionManager.disconnectAll();
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;

		const leaves = workspace.getLeavesOfType(VIEW_TYPE_PG_BROWSER);
		if (leaves.length > 0) {
			workspace.revealLeaf(leaves[0]);
			return;
		}

		const leaf = workspace.getLeaf("tab");
		await leaf.setViewState({
			type: VIEW_TYPE_PG_BROWSER,
			active: true,
		});
		workspace.revealLeaf(leaf);
	}
}

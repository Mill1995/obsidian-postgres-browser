import { Plugin, WorkspaceLeaf } from "obsidian";
import type { PluginSettings } from "./types";
import { DEFAULT_SETTINGS, MAX_PREVIEW_ROW_LIMIT, VIEW_TYPE_PG_BROWSER } from "./constants";
import { PostgresBrowserSettingTab } from "./settings";
import { PostgresBrowserView } from "./views/database-view";
import { ConnectionManager } from "./db/connection-manager";
import { SchemaIntrospection } from "./db/schema-introspection";
import { QueryExecutor } from "./db/query-executor";
import { ConnectionSecretStorage } from "./secret-storage";

export default class PostgresBrowserPlugin extends Plugin {
	settings: PluginSettings = DEFAULT_SETTINGS;
	connectionManager: ConnectionManager = new ConnectionManager();
	schemaIntrospection: SchemaIntrospection = new SchemaIntrospection();
	queryExecutor: QueryExecutor = new QueryExecutor();
	secretStorage!: ConnectionSecretStorage;

	async onload(): Promise<void> {
		this.secretStorage = new ConnectionSecretStorage(this.app);
		await this.loadSettings();

		this.registerView(
			VIEW_TYPE_PG_BROWSER,
			(leaf: WorkspaceLeaf) => new PostgresBrowserView(leaf, this)
		);

		this.addRibbonIcon("database", "Open PostgreSQL browser", () => {
			void this.activateView();
		});

		this.addCommand({
			id: "open-view",
			name: "Open",
			callback: () => { void this.activateView(); },
		});

		this.addCommand({
			id: "open-in-new-window",
			name: "Open in new window",
			callback: () => { void this.activateViewInWindow(); },
		});

		this.addSettingTab(new PostgresBrowserSettingTab(this.app, this));
	}

	onunload(): void {
		void this.connectionManager.disconnectAll();
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);

		// Clamp numeric settings to valid ranges (protects against tampered data.json)
		this.settings.queryTimeoutSeconds = Math.max(1, Math.min(300, Math.round(this.settings.queryTimeoutSeconds || DEFAULT_SETTINGS.queryTimeoutSeconds)));
		this.settings.previewRowLimit = Math.max(1, Math.min(MAX_PREVIEW_ROW_LIMIT, Math.round(this.settings.previewRowLimit || DEFAULT_SETTINGS.previewRowLimit)));

		let needsSave = false;

		for (const conn of this.settings.connections) {
			if (conn.isSecured) {
				const secret = this.secretStorage.retrieve(conn.id);
				if (secret) {
					conn.connectionString = secret;
				} else {
					console.warn(
						`[postgres-browser] Secret lost for "${conn.name}" — re-enter the connection string in settings.`
					);
					conn.connectionString = "";
				}
			} else if (conn.connectionString && this.secretStorage.available) {
				this.secretStorage.store(conn.id, conn.connectionString);
				conn.isSecured = true;
				needsSave = true;
			}
		}

		if (needsSave) {
			await this.saveSettings();
		}
	}

	async saveSettings(): Promise<void> {
		const toSave = structuredClone(this.settings);
		for (let i = 0; i < toSave.connections.length; i++) {
			const conn = toSave.connections[i];
			if (conn.connectionString && this.secretStorage.available) {
				this.secretStorage.store(conn.id, conn.connectionString);
				conn.isSecured = true;
				this.settings.connections[i].isSecured = true;
				conn.connectionString = "";
			}
		}
		await this.saveData(toSave);
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;

		const leaves = workspace.getLeavesOfType(VIEW_TYPE_PG_BROWSER);
		if (leaves.length > 0) {
			await workspace.revealLeaf(leaves[0]);
			return;
		}

		const leaf = workspace.getLeaf("tab");
		await leaf.setViewState({
			type: VIEW_TYPE_PG_BROWSER,
			active: true,
		});
		await workspace.revealLeaf(leaf);
	}

	async activateViewInWindow(): Promise<void> {
		const leaf = this.app.workspace.getLeaf("window");
		await leaf.setViewState({
			type: VIEW_TYPE_PG_BROWSER,
			active: true,
		});
		await this.app.workspace.revealLeaf(leaf);
	}
}

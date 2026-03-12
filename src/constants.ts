import type { PluginSettings } from "./types";

export const VIEW_TYPE_PG_BROWSER = "postgres-browser-view";

export const DEFAULT_SETTINGS: PluginSettings = {
	connections: [],
	activeConnectionId: null,
	previewRowLimit: 100,
	queryTimeoutSeconds: 30,
};

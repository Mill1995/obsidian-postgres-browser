import type { PluginSettings } from "./types";

export const VIEW_TYPE_PG_BROWSER = "postgres-browser-view";

export const MAX_PREVIEW_ROW_LIMIT = 10_000;

export const DEFAULT_SETTINGS: PluginSettings = {
	connections: [],
	activeConnectionId: null,
	previewRowLimit: 100,
	queryTimeoutSeconds: 30,
};

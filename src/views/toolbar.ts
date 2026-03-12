import { setIcon } from "obsidian";
import type PostgresBrowserPlugin from "../main";
import type { ViewMode } from "../types";
import { ConnectionSelector } from "./connection-selector";

export class Toolbar {
	private connectionInfoEl: HTMLSpanElement;
	private dataTabBtn: HTMLButtonElement;
	private queryTabBtn: HTMLButtonElement;
	private schemaTabBtn: HTMLButtonElement;
	private currentMode: ViewMode = "data";
	connectionSelector: ConnectionSelector;

	constructor(
		container: HTMLElement,
		plugin: PostgresBrowserPlugin,
		onConnectionChanged: (id: string | null) => void,
		onRefresh: () => void,
		onModeChange: (mode: ViewMode) => void,
		onPopout: () => void
	) {
		container.addClass("pg-toolbar");

		const leftGroup = container.createDiv({ cls: "pg-toolbar-left" });

		const selectorContainer = leftGroup.createDiv({
			cls: "pg-toolbar-selector",
		});
		this.connectionSelector = new ConnectionSelector(
			selectorContainer,
			plugin,
			onConnectionChanged,
			onRefresh
		);

		this.connectionInfoEl = leftGroup.createSpan({
			cls: "pg-toolbar-info",
		});

		const rightGroup = container.createDiv({ cls: "pg-toolbar-right" });

		const modeGroup = rightGroup.createDiv({ cls: "pg-mode-group" });

		this.dataTabBtn = modeGroup.createEl("button", {
			text: "Table Data",
			cls: "pg-mode-tab pg-active",
		});
		this.dataTabBtn.addEventListener("click", () => {
			this.setMode("data");
			onModeChange("data");
		});

		this.queryTabBtn = modeGroup.createEl("button", {
			text: "SQL Query",
			cls: "pg-mode-tab",
		});
		this.queryTabBtn.addEventListener("click", () => {
			this.setMode("query");
			onModeChange("query");
		});

		this.schemaTabBtn = modeGroup.createEl("button", {
			text: "Schema",
			cls: "pg-mode-tab",
		});
		this.schemaTabBtn.addEventListener("click", () => {
			this.setMode("schema");
			onModeChange("schema");
		});

		const popoutBtn = rightGroup.createEl("button", {
			cls: "pg-popout-btn clickable-icon",
			attr: { "aria-label": "Open in new window" },
		});
		setIcon(popoutBtn, "arrow-up-right");
		popoutBtn.addEventListener("click", onPopout);
	}

	setConnectionInfo(text: string): void {
		this.connectionInfoEl.textContent = text;
	}

	setMode(mode: ViewMode): void {
		this.currentMode = mode;
		this.dataTabBtn.toggleClass("pg-active", mode === "data");
		this.queryTabBtn.toggleClass("pg-active", mode === "query");
		this.schemaTabBtn.toggleClass("pg-active", mode === "schema");
	}

	getMode(): ViewMode {
		return this.currentMode;
	}
}

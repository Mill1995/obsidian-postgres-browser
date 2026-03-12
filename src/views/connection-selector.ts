import { setIcon } from "obsidian";
import type PostgresBrowserPlugin from "../main";

export class ConnectionSelector {
	private selectEl: HTMLSelectElement;
	private plugin: PostgresBrowserPlugin;
	private onChange: (connectionId: string | null) => void;
	private onRefresh: () => void;

	constructor(
		container: HTMLElement,
		plugin: PostgresBrowserPlugin,
		onChange: (connectionId: string | null) => void,
		onRefresh: () => void
	) {
		this.plugin = plugin;
		this.onChange = onChange;
		this.onRefresh = onRefresh;

		const wrapper = container.createDiv({ cls: "pg-selector-wrapper" });

		this.selectEl = wrapper.createEl("select", { cls: "pg-select" });
		this.buildOptions();

		this.selectEl.addEventListener("change", () => {
			const val = this.selectEl.value || null;
			this.onChange(val);
		});

		const refreshBtn = wrapper.createEl("button", {
			cls: "pg-refresh-btn clickable-icon",
			attr: { "aria-label": "Refresh schema" },
		});
		setIcon(refreshBtn, "refresh-cw");
		refreshBtn.addEventListener("click", () => this.onRefresh());
	}

	private buildOptions(): void {
		this.selectEl.empty();

		this.selectEl.createEl("option", {
			value: "",
			text: "-- Select connection --",
		});

		for (const conn of this.plugin.settings.connections) {
			this.selectEl.createEl("option", {
				value: conn.id,
				text: conn.name,
			});
		}

		this.selectEl.value =
			this.plugin.settings.activeConnectionId ?? "";
	}

	refresh(): void {
		this.buildOptions();
	}
}

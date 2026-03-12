import type { QueryResult } from "../types";
import { ResultsTable } from "./results-table";

export class DataView {
	private container: HTMLElement;
	private breadcrumbEl: HTMLElement;
	private resultsTable: ResultsTable;
	private footerEl: HTMLElement;
	private emptyEl: HTMLElement;
	private contentEl: HTMLElement;

	constructor(container: HTMLElement) {
		this.container = container;
		this.container.addClass("pg-data-view");

		this.emptyEl = this.container.createDiv({ cls: "pg-data-empty" });
		this.emptyEl.createEl("p", {
			text: "Select a table from the sidebar to preview its data.",
			cls: "pg-muted",
		});

		this.contentEl = this.container.createDiv({
			cls: "pg-data-content pg-hidden",
		});

		this.breadcrumbEl = this.contentEl.createDiv({
			cls: "pg-breadcrumb",
		});

		const resultsContainer = this.contentEl.createDiv({
			cls: "pg-results",
		});
		this.resultsTable = new ResultsTable(resultsContainer);

		this.footerEl = this.contentEl.createDiv({ cls: "pg-data-footer" });
	}

	showTable(schema: string, table: string, result: QueryResult): void {
		this.emptyEl.addClass("pg-hidden");
		this.contentEl.removeClass("pg-hidden");

		this.breadcrumbEl.empty();
		this.breadcrumbEl.createSpan({
			text: schema,
			cls: "pg-breadcrumb-schema",
		});
		this.breadcrumbEl.createSpan({
			text: " > ",
			cls: "pg-breadcrumb-sep",
		});
		this.breadcrumbEl.createSpan({
			text: table,
			cls: "pg-breadcrumb-table",
		});
		this.breadcrumbEl.createSpan({
			text: `[${result.rowCount}]`,
			cls: "pg-breadcrumb-count",
		});

		this.resultsTable.renderResult(result);

		this.footerEl.textContent = `${result.rowCount} rows | ${result.duration}ms`;
	}

	showEmpty(): void {
		this.emptyEl.removeClass("pg-hidden");
		this.contentEl.addClass("pg-hidden");
	}

	clear(): void {
		this.resultsTable.clear();
		this.footerEl.textContent = "";
		this.showEmpty();
	}
}

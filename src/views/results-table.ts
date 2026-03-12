import type { QueryResult, QueryError } from "../types";

export class ResultsTable {
	private container: HTMLElement;

	constructor(container: HTMLElement) {
		this.container = container;
	}

	renderResult(result: QueryResult): void {
		this.container.empty();

		const statusBar = this.container.createDiv({
			cls: "pg-results-status",
		});
		statusBar.createSpan({
			text: `${result.rowCount} rows | ${result.duration}ms | ${result.command}`,
		});

		if (result.columns.length === 0) {
			this.container.createEl("p", {
				text: `Query executed successfully. ${result.rowCount} rows affected.`,
				cls: "pg-muted",
			});
			return;
		}

		const scrollWrapper = this.container.createDiv({
			cls: "pg-results-scroll",
		});

		const table = scrollWrapper.createEl("table", {
			cls: "pg-results-table",
		});

		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		for (const col of result.columns) {
			headerRow.createEl("th", { text: col });
		}

		const tbody = table.createEl("tbody");
		for (const row of result.rows) {
			const tr = tbody.createEl("tr");
			for (const col of result.columns) {
				const val = row[col];
				const display =
					val === null
						? "NULL"
						: val === undefined
							? ""
							: String(val);
				const td = tr.createEl("td", { text: display });
				if (val === null) td.addClass("pg-null-value");
			}
		}
	}

	renderError(error: QueryError): void {
		this.container.empty();

		const errorDiv = this.container.createDiv({ cls: "pg-error" });
		errorDiv.createEl("strong", {
			text: `Error${error.code ? ` [${error.code}]` : ""}`,
		});
		errorDiv.createEl("p", { text: error.message });

		if (error.detail) {
			errorDiv.createEl("p", {
				text: `Detail: ${error.detail}`,
				cls: "pg-error-detail",
			});
		}
		if (error.hint) {
			errorDiv.createEl("p", {
				text: `Hint: ${error.hint}`,
				cls: "pg-error-hint",
			});
		}
	}

	clear(): void {
		this.container.empty();
	}
}

import type { QueryResult, QueryError } from "../types";
import { QueryEditor } from "./query-editor";
import { ResultsTable } from "./results-table";

export class QueryView {
	private container: HTMLElement;
	private queryEditor: QueryEditor;
	private resultsTable: ResultsTable;

	constructor(
		container: HTMLElement,
		onRunQuery: (queryText: string) => void
	) {
		this.container = container;
		this.container.addClass("pg-query-view");

		const editorContainer = this.container.createDiv({
			cls: "pg-query-editor",
		});
		this.queryEditor = new QueryEditor(editorContainer, onRunQuery);

		const resultsContainer = this.container.createDiv({
			cls: "pg-results",
		});
		this.resultsTable = new ResultsTable(resultsContainer);
	}

	showResult(result: QueryResult): void {
		this.resultsTable.renderResult(result);
		this.queryEditor.setStatus(
			`${result.rowCount} rows | ${result.duration}ms | ${result.command}`
		);
	}

	showError(error: QueryError): void {
		this.resultsTable.renderError(error);
		this.queryEditor.setStatus("Query failed");
	}

	setStatus(text: string): void {
		this.queryEditor.setStatus(text);
	}

	setLoading(loading: boolean): void {
		this.queryEditor.setLoading(loading);
	}
}

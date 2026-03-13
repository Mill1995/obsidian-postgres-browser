import { Notice, setIcon } from "obsidian";
import type { QueryResult, QueryError, ColumnInfo } from "../types";
import { CellEditor } from "./cell-editor";
import type { CellEditResult } from "./cell-editor";

export interface EditableTableConfig {
	schema: string;
	table: string;
	columnMeta: ColumnInfo[];
	pkColumns: string[];
	onCellUpdate: (
		column: string,
		newValue: unknown,
		row: Record<string, unknown>
	) => Promise<void>;
	onRowDelete: (row: Record<string, unknown>) => Promise<void>;
}

interface PendingChange {
	td: HTMLTableCellElement;
	column: string;
	rowIndex: number;
	oldValue: unknown;
	oldContent: string;
	oldIsNull: boolean;
	newValue: unknown;
	row: Record<string, unknown>;
}

export class ResultsTable {
	private container: HTMLElement;
	private editConfig: EditableTableConfig | null = null;
	private currentResult: QueryResult | null = null;
	private columnMeta: ColumnInfo[] | null = null;
	private pendingChanges: Map<string, PendingChange> = new Map();
	private pendingDeletions: Map<number, { tr: HTMLTableRowElement; row: Record<string, unknown> }> = new Map();
	private saveBarEl: HTMLElement | null = null;
	private saveBarTextEl: HTMLElement | null = null;

	constructor(container: HTMLElement) {
		this.container = container;
	}

	setEditConfig(config: EditableTableConfig | null): void {
		this.editConfig = config;
	}

	renderResult(
		result: QueryResult,
		columnMeta?: ColumnInfo[]
	): void {
		this.container.empty();
		this.currentResult = result;
		this.columnMeta = columnMeta ?? null;
		this.pendingChanges.clear();
		this.pendingDeletions.clear();

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

		// Show editing disabled notice if edit config exists but no PK
		if (this.editConfig && this.editConfig.pkColumns.length === 0) {
			const notice = this.container.createDiv({
				cls: "pg-edit-notice",
			});
			notice.createSpan({
				text: "Editing disabled: no primary key",
			});
		}

		const scrollWrapper = this.container.createDiv({
			cls: "pg-results-scroll",
		});

		const table = scrollWrapper.createEl("table", {
			cls: "pg-results-table",
		});

		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");

		// Row number column header
		headerRow.createEl("th", { text: "#", cls: "pg-row-num-header" });

		const metaMap = new Map<string, ColumnInfo>();
		if (columnMeta) {
			for (const col of columnMeta) {
				metaMap.set(col.name, col);
			}
		}

		for (const col of result.columns) {
			const th = headerRow.createEl("th");
			th.createDiv({ text: col, cls: "pg-col-name" });
			const meta = metaMap.get(col);
			if (meta) {
				th.createDiv({
					text: formatDataType(meta),
					cls: "pg-col-type",
				});
			}
		}

		const isEditable =
			this.editConfig !== null && this.editConfig.pkColumns.length > 0;

		const tbody = table.createEl("tbody");
		for (let rowIdx = 0; rowIdx < result.rows.length; rowIdx++) {
			const row = result.rows[rowIdx];
			const tr = tbody.createEl("tr");

			// Row number with delete button
			const rowNumTd = tr.createEl("td", {
				cls: "pg-row-num",
			});
			rowNumTd.createSpan({
				text: String(rowIdx + 1),
				cls: "pg-row-num-text",
			});

			if (isEditable) {
				const deleteBtn = rowNumTd.createEl("button", {
					cls: "pg-row-delete-btn",
					attr: { "aria-label": "Delete row" },
				});
				setIcon(deleteBtn, "trash-2");
				deleteBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					this.toggleRowDeletion(rowIdx, tr, row);
				});
			}

			for (const col of result.columns) {
				const val = row[col];
				const display = stringifyValue(val);
				const td = tr.createEl("td", { text: display });
				if (val === null) td.addClass("pg-null-value");

				if (isEditable) {
					td.addClass("pg-cell-editable");
					td.addEventListener("dblclick", () => {
						this.startEditing(
							td,
							col,
							row[col],
							rowIdx,
							row
						);
					});
				}
			}
		}

		// Save bar (hidden initially)
		this.createSaveBar();
	}

	private createSaveBar(): void {
		const bar = this.container.createDiv({
			cls: "pg-save-bar pg-hidden",
		});
		this.saveBarEl = bar;

		this.saveBarTextEl = bar.createSpan({ cls: "pg-save-bar-text" });

		const saveBtn = bar.createEl("button", {
			text: "Save changes",
			cls: "pg-save-btn",
		});
		saveBtn.addEventListener("click", () => void this.batchSave());

		const discardBtn = bar.createEl("button", {
			text: "Discard",
			cls: "pg-discard-btn",
		});
		discardBtn.addEventListener("click", () => this.batchDiscard());
	}

	private toggleRowDeletion(
		rowIndex: number,
		tr: HTMLTableRowElement,
		row: Record<string, unknown>
	): void {
		if (this.pendingDeletions.has(rowIndex)) {
			this.pendingDeletions.delete(rowIndex);
			tr.removeClass("pg-row-pending-delete");
		} else {
			this.pendingDeletions.set(rowIndex, { tr, row });
			tr.addClass("pg-row-pending-delete");
		}
		this.updateSaveBar();
	}

	private updateSaveBar(): void {
		if (!this.saveBarEl || !this.saveBarTextEl) return;

		const count = this.pendingChanges.size + this.pendingDeletions.size;
		if (count === 0) {
			this.saveBarEl.addClass("pg-hidden");
		} else {
			this.saveBarEl.removeClass("pg-hidden");
			this.saveBarTextEl.textContent =
				count === 1
					? "1 unsaved change"
					: `${count} unsaved changes`;
		}
	}

	private startEditing(
		td: HTMLTableCellElement,
		columnName: string,
		currentValue: unknown,
		rowIndex: number,
		row: Record<string, unknown>
	): void {
		if (!this.editConfig) return;

		// Don't start editing if already editing
		if (td.hasClass("pg-cell-editing")) return;

		const meta = this.editConfig.columnMeta.find(
			(c) => c.name === columnName
		);
		if (!meta) return;

		const key = `${rowIndex}:${columnName}`;
		const existingPending = this.pendingChanges.get(key);

		// Use the pending value if it exists (re-editing a staged cell),
		// otherwise the current in-memory value
		const editValue = existingPending
			? existingPending.newValue
			: currentValue;

		// Capture original state before any pending change was applied
		const oldValue = existingPending
			? existingPending.oldValue
			: currentValue;
		const oldContent = existingPending
			? existingPending.oldContent
			: td.textContent ?? "";
		const oldIsNull = existingPending
			? existingPending.oldIsNull
			: currentValue === null;

		const editor = new CellEditor(
			td,
			meta,
			editValue,
			rowIndex,
			(result: CellEditResult) => {
				// Stage the change
				this.pendingChanges.set(key, {
					td,
					column: result.column,
					rowIndex: result.rowIndex,
					oldValue,
					oldContent,
					oldIsNull,
					newValue: result.newValue,
					row,
				});
				// Update in-memory row data
				row[result.column] = result.newValue;
				this.updateSaveBar();
			},
			() => {
				// onCancel - nothing extra needed
			}
		);
		editor.activate();
	}

	private async batchSave(): Promise<void> {
		if (!this.editConfig) return;

		const config = this.editConfig;
		const entries = [...this.pendingChanges.entries()];

		for (const [key, change] of entries) {
			try {
				await config.onCellUpdate(
					change.column,
					change.newValue,
					change.row
				);
				// Success: remove pending state, flash green
				change.td.removeClass("pg-cell-pending");
				this.flashCell(change.td, "pg-cell-saved");
				this.pendingChanges.delete(key);
			} catch (err) {
				// Failure: revert cell to original
				change.td.empty();
				change.td.removeClass("pg-cell-pending");
				change.td.textContent = change.oldContent;
				if (change.oldIsNull) {
					change.td.addClass("pg-null-value");
				} else {
					change.td.removeClass("pg-null-value");
				}
				// Revert in-memory row data
				change.row[change.column] = change.oldValue;
				this.flashCell(change.td, "pg-cell-error");
				this.pendingChanges.delete(key);

				const message =
					err instanceof Error ? err.message : String(err);
				new Notice(
					`Failed to save ${change.column}: ${message}`
				);
			}
		}

		// Process pending deletions
		const deletionEntries = [...this.pendingDeletions.entries()];
		for (const [key, deletion] of deletionEntries) {
			try {
				await config.onRowDelete(deletion.row);
				// Success: remove row from DOM with flash
				deletion.tr.addClass("pg-cell-saved");
				setTimeout(() => {
					deletion.tr.remove();
				}, 400);
				this.pendingDeletions.delete(key);
			} catch (err) {
				// Failure: un-mark the row
				deletion.tr.removeClass("pg-row-pending-delete");
				this.pendingDeletions.delete(key);

				const message =
					err instanceof Error ? err.message : String(err);
				new Notice(`Failed to delete row: ${message}`);
			}
		}

		this.updateSaveBar();
	}

	private batchDiscard(): void {
		for (const [, change] of this.pendingChanges) {
			change.td.empty();
			change.td.removeClass("pg-cell-pending");
			change.td.textContent = change.oldContent;
			if (change.oldIsNull) {
				change.td.addClass("pg-null-value");
			} else {
				change.td.removeClass("pg-null-value");
			}
			// Revert in-memory row data
			change.row[change.column] = change.oldValue;
		}
		this.pendingChanges.clear();

		// Clear pending deletions
		for (const [, deletion] of this.pendingDeletions) {
			deletion.tr.removeClass("pg-row-pending-delete");
		}
		this.pendingDeletions.clear();

		this.updateSaveBar();
	}

	private flashCell(td: HTMLTableCellElement, cls: string): void {
		td.addClass(cls);
		setTimeout(() => {
			td.removeClass(cls);
		}, 800);
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
		this.editConfig = null;
		this.currentResult = null;
		this.columnMeta = null;
		this.pendingChanges.clear();
		this.pendingDeletions.clear();
		this.saveBarEl = null;
		this.saveBarTextEl = null;
	}
}

function stringifyValue(val: unknown): string {
	if (val === null) return "NULL";
	if (val === undefined) return "";
	if (typeof val === "object") return JSON.stringify(val);
	return String(val as string | number | boolean | bigint);
}

function formatDataType(col: ColumnInfo): string {
	const dt = col.dataType;

	if (dt === "USER-DEFINED") {
		return col.udtName;
	}

	if (dt === "character varying") {
		return col.characterMaximumLength
			? `varchar(${col.characterMaximumLength})`
			: "varchar";
	}

	if (dt === "character") {
		return col.characterMaximumLength
			? `char(${col.characterMaximumLength})`
			: "char";
	}

	if (dt === "numeric") {
		if (col.numericPrecision !== null && col.numericScale !== null) {
			return `numeric(${col.numericPrecision},${col.numericScale})`;
		}
		if (col.numericPrecision !== null) {
			return `numeric(${col.numericPrecision})`;
		}
		return "numeric";
	}

	return col.udtName || dt;
}

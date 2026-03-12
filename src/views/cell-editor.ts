import type { ColumnInfo } from "../types";

function stringifyValue(val: unknown): string {
	if (typeof val === "object" && val !== null) return JSON.stringify(val);
	return String(val);
}

export interface CellEditResult {
	column: string;
	newValue: unknown;
	rowIndex: number;
}

export class CellEditor {
	private td: HTMLTableCellElement;
	private column: ColumnInfo;
	private originalValue: unknown;
	private rowIndex: number;
	private onStage: (result: CellEditResult) => void;
	private onCancel: () => void;
	private originalContent: string;
	private editorEl: HTMLElement | null = null;
	private closed = false;

	constructor(
		td: HTMLTableCellElement,
		column: ColumnInfo,
		currentValue: unknown,
		rowIndex: number,
		onStage: (result: CellEditResult) => void,
		onCancel: () => void
	) {
		this.td = td;
		this.column = column;
		this.originalValue = currentValue;
		this.rowIndex = rowIndex;
		this.onStage = onStage;
		this.onCancel = onCancel;
		this.originalContent = td.textContent ?? "";
	}

	activate(): void {
		this.td.empty();
		this.td.addClass("pg-cell-editing");

		const wrapper = this.td.createDiv({ cls: "pg-cell-editor-wrapper" });

		if (this.isBooleanType()) {
			this.editorEl = this.createBooleanEditor(wrapper);
		} else if (
			this.column.enumValues &&
			this.column.enumValues.length > 0
		) {
			this.editorEl = this.createEnumEditor(wrapper);
		} else if (this.isLongTextType()) {
			this.editorEl = this.createTextareaEditor(wrapper);
		} else {
			this.editorEl = this.createInputEditor(wrapper);
		}

		if (this.column.isNullable) {
			const nullBtn = wrapper.createEl("button", {
				text: "NULL",
				cls: "pg-null-btn",
			});
			nullBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				this.stage(null);
			});
		}

		// Focus the editor
		if (
			this.editorEl instanceof HTMLInputElement ||
			this.editorEl instanceof HTMLTextAreaElement
		) {
			this.editorEl.focus();
			this.editorEl.select();
		} else if (this.editorEl instanceof HTMLSelectElement) {
			this.editorEl.focus();
		}

		// Click-outside cancel: when focus leaves the wrapper, cancel the edit.
		// Use setTimeout(0) to let clicks on the NULL button (which briefly
		// steal focus) complete before deciding.
		wrapper.addEventListener("focusout", () => {
			setTimeout(() => {
				if (this.closed) return;
				if (!wrapper.contains(document.activeElement)) {
					this.cancel();
				}
			}, 0);
		});
	}

	private createBooleanEditor(wrapper: HTMLElement): HTMLSelectElement {
		const select = wrapper.createEl("select", {
			cls: "pg-cell-select",
		});

		const options = ["true", "false"];
		if (this.column.isNullable) {
			options.push("NULL");
		}

		for (const opt of options) {
			const option = select.createEl("option", {
				text: opt,
				value: opt,
			});
			if (
				(this.originalValue === true && opt === "true") ||
				(this.originalValue === false && opt === "false") ||
				(this.originalValue === null && opt === "NULL")
			) {
				option.selected = true;
			}
		}

		select.addEventListener("change", () => {
			const val = select.value;
			if (val === "NULL") this.stage(null);
			else this.stage(val === "true");
		});

		select.addEventListener("keydown", (e) => {
			if (e.key === "Escape") this.cancel();
		});

		return select;
	}

	private createEnumEditor(wrapper: HTMLElement): HTMLSelectElement {
		const select = wrapper.createEl("select", {
			cls: "pg-cell-select",
		});

		if (this.column.isNullable) {
			const nullOpt = select.createEl("option", {
				text: "NULL",
				value: "__NULL__",
			});
			if (this.originalValue === null) nullOpt.selected = true;
		}

		for (const val of this.column.enumValues!) {
			const option = select.createEl("option", {
				text: val,
				value: val,
			});
			if (String(this.originalValue) === val) {
				option.selected = true;
			}
		}

		select.addEventListener("change", () => {
			if (select.value === "__NULL__") this.stage(null);
			else this.stage(select.value);
		});

		select.addEventListener("keydown", (e) => {
			if (e.key === "Escape") this.cancel();
		});

		return select;
	}

	private createTextareaEditor(wrapper: HTMLElement): HTMLTextAreaElement {
		const textarea = wrapper.createEl("textarea", {
			cls: "pg-cell-textarea",
		});
		textarea.value =
			this.originalValue === null ? "" : stringifyValue(this.originalValue);
		textarea.rows = 3;

		textarea.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				this.stageFromText(textarea.value);
			} else if (e.key === "Escape") {
				this.cancel();
			}
		});

		return textarea;
	}

	private createInputEditor(wrapper: HTMLElement): HTMLInputElement {
		const input = wrapper.createEl("input", {
			type: "text",
			cls: "pg-cell-input",
		});
		input.value =
			this.originalValue === null ? "" : stringifyValue(this.originalValue);

		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				this.stageFromText(input.value);
			} else if (e.key === "Escape") {
				this.cancel();
			}
		});

		return input;
	}

	private stageFromText(text: string): void {
		const coerced = this.coerceValue(text);
		this.stage(coerced);
	}

	private stage(value: unknown): void {
		if (this.closed) return;

		// Don't stage if value hasn't changed
		if (value === this.originalValue) {
			this.cancel();
			return;
		}

		this.closed = true;

		// Close editor and update display
		this.td.empty();
		this.td.removeClass("pg-cell-editing");
		if (value === null) {
			this.td.textContent = "NULL";
			this.td.addClass("pg-null-value");
		} else {
			this.td.textContent = stringifyValue(value);
			this.td.removeClass("pg-null-value");
		}
		this.td.addClass("pg-cell-pending");

		this.onStage({
			column: this.column.name,
			newValue: value,
			rowIndex: this.rowIndex,
		});
	}

	private cancel(): void {
		if (this.closed) return;
		this.closed = true;

		this.td.empty();
		this.td.removeClass("pg-cell-editing");
		this.td.textContent = this.originalContent;
		if (this.originalValue === null) {
			this.td.addClass("pg-null-value");
		}
		this.onCancel();
	}

	private coerceValue(text: string): unknown {
		// Empty string -> NULL for nullable columns
		if (text === "" && this.column.isNullable) {
			return null;
		}

		const dt = this.column.dataType.toLowerCase();
		const udt = this.column.udtName.toLowerCase();

		// Numeric types
		if (
			dt === "integer" ||
			dt === "bigint" ||
			dt === "smallint" ||
			udt === "int2" ||
			udt === "int4" ||
			udt === "int8"
		) {
			const n = Number(text);
			if (!isNaN(n)) return n;
		}

		if (
			dt === "numeric" ||
			dt === "decimal" ||
			dt === "real" ||
			dt === "double precision" ||
			udt === "float4" ||
			udt === "float8"
		) {
			const n = Number(text);
			if (!isNaN(n)) return n;
		}

		// Boolean
		if (dt === "boolean" || udt === "bool") {
			if (text.toLowerCase() === "true") return true;
			if (text.toLowerCase() === "false") return false;
		}

		// JSON/JSONB — parse back into an object
		if (dt === "json" || dt === "jsonb" || udt === "json" || udt === "jsonb") {
			try {
				return JSON.parse(text);
			} catch {
				return text;
			}
		}

		return text;
	}

	private isBooleanType(): boolean {
		return (
			this.column.dataType.toLowerCase() === "boolean" ||
			this.column.udtName.toLowerCase() === "bool"
		);
	}

	private isLongTextType(): boolean {
		const dt = this.column.dataType.toLowerCase();
		const udt = this.column.udtName.toLowerCase();
		// Always use textarea for JSON types
		if (dt === "json" || dt === "jsonb") return true;
		if (udt === "json" || udt === "jsonb") return true;
		// Use textarea if current value is multiline or long
		if (this.originalValue !== null) {
			const str = stringifyValue(this.originalValue);
			if (str.includes("\n") || str.length > 100) return true;
		}
		return false;
	}
}

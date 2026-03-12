import type { TableDetailInfo, ColumnInfo } from "../types";

export class SchemaDetailView {
	private container: HTMLElement;
	private emptyEl: HTMLElement;
	private contentEl: HTMLElement;

	constructor(container: HTMLElement) {
		this.container = container;
		this.container.addClass("pg-schema-detail-view");

		this.emptyEl = this.container.createDiv({ cls: "pg-data-empty" });
		this.emptyEl.createEl("p", {
			text: "Select a table and click the Schema tab to view its structure.",
			cls: "pg-muted",
		});

		this.contentEl = this.container.createDiv({
			cls: "pg-schema-detail-content pg-hidden",
		});
	}

	showDetail(detail: TableDetailInfo): void {
		this.emptyEl.addClass("pg-hidden");
		this.contentEl.removeClass("pg-hidden");
		this.contentEl.empty();

		// Header
		const header = this.contentEl.createDiv({
			cls: "pg-schema-detail-header",
		});
		header.createEl("h3", {
			text: `${detail.schema}.${detail.table}`,
		});
		if (detail.estimatedRowCount > 0) {
			header.createSpan({
				text: `~${detail.estimatedRowCount.toLocaleString()} rows`,
				cls: "pg-schema-row-count",
			});
		}

		// Columns section
		this.renderColumnsSection(detail);

		// Constraints section
		if (detail.constraints.length > 0) {
			this.renderConstraintsSection(detail);
		}

		// Indexes section
		if (detail.indexes.length > 0) {
			this.renderIndexesSection(detail);
		}
	}

	private renderColumnsSection(detail: TableDetailInfo): void {
		const section = this.contentEl.createDiv({
			cls: "pg-schema-section",
		});
		section.createEl("h4", { text: "Columns" });

		const scrollWrapper = section.createDiv({
			cls: "pg-schema-table-scroll",
		});
		const table = scrollWrapper.createEl("table", {
			cls: "pg-schema-table",
		});

		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		for (const h of [
			"#",
			"Name",
			"Type",
			"Nullable",
			"Default",
			"Badges",
		]) {
			headerRow.createEl("th", { text: h });
		}

		const tbody = table.createEl("tbody");
		for (const col of detail.columns) {
			const tr = tbody.createEl("tr");
			tr.createEl("td", {
				text: String(col.ordinalPosition),
				cls: "pg-schema-ordinal",
			});
			tr.createEl("td", {
				text: col.name,
				cls: col.isPrimaryKey ? "pg-schema-col-pk" : "",
			});
			tr.createEl("td", {
				text: this.formatFullType(col),
				cls: "pg-schema-type",
			});
			tr.createEl("td", {
				text: col.isNullable ? "YES" : "NO",
				cls: col.isNullable ? "" : "pg-schema-not-null",
			});
			tr.createEl("td", {
				text: col.columnDefault ?? "",
				cls: "pg-schema-default",
			});

			const badgeTd = tr.createEl("td", { cls: "pg-schema-badges" });
			if (col.isPrimaryKey) {
				badgeTd.createSpan({
					text: "PK",
					cls: "pg-badge pg-badge-pk",
				});
			}
			if (col.isForeignKey && col.foreignKeyTarget) {
				const fk = col.foreignKeyTarget;
				badgeTd.createSpan({
					text: `FK -> ${fk.table}.${fk.column}`,
					cls: "pg-badge pg-badge-fk",
				});
			}
			if (col.enumValues && col.enumValues.length > 0) {
				badgeTd.createSpan({
					text: `enum: ${col.enumValues.join(", ")}`,
					cls: "pg-badge pg-badge-enum",
				});
			}
		}
	}

	private renderConstraintsSection(detail: TableDetailInfo): void {
		const section = this.contentEl.createDiv({
			cls: "pg-schema-section",
		});
		section.createEl("h4", { text: "Constraints" });

		const scrollWrapper = section.createDiv({
			cls: "pg-schema-table-scroll",
		});
		const table = scrollWrapper.createEl("table", {
			cls: "pg-schema-table",
		});

		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		for (const h of ["Name", "Type", "Columns", "Details"]) {
			headerRow.createEl("th", { text: h });
		}

		const tbody = table.createEl("tbody");
		for (const c of detail.constraints) {
			const tr = tbody.createEl("tr");
			tr.createEl("td", { text: c.name });
			tr.createEl("td", { text: c.type });
			tr.createEl("td", { text: c.columns.join(", ") });

			let details = "";
			if (c.type === "FOREIGN KEY" && c.foreignTable) {
				details = `-> ${c.foreignSchema ?? ""}.${c.foreignTable}(${(c.foreignColumns ?? []).join(", ")})`;
			} else if (c.definition) {
				details = c.definition;
			}
			tr.createEl("td", { text: details, cls: "pg-schema-detail-text" });
		}
	}

	private renderIndexesSection(detail: TableDetailInfo): void {
		const section = this.contentEl.createDiv({
			cls: "pg-schema-section",
		});
		section.createEl("h4", { text: "Indexes" });

		const scrollWrapper = section.createDiv({
			cls: "pg-schema-table-scroll",
		});
		const table = scrollWrapper.createEl("table", {
			cls: "pg-schema-table",
		});

		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		for (const h of [
			"Name",
			"Columns",
			"Type",
			"Unique",
			"Definition",
		]) {
			headerRow.createEl("th", { text: h });
		}

		const tbody = table.createEl("tbody");
		for (const idx of detail.indexes) {
			const tr = tbody.createEl("tr");
			tr.createEl("td", { text: idx.name });
			tr.createEl("td", { text: idx.columns.join(", ") });
			tr.createEl("td", { text: idx.indexType });
			tr.createEl("td", {
				text: idx.isUnique ? (idx.isPrimary ? "PK" : "Yes") : "No",
			});
			tr.createEl("td", {
				text: idx.definition,
				cls: "pg-schema-detail-text",
			});
		}
	}

	private formatFullType(col: ColumnInfo): string {
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
			if (
				col.numericPrecision !== null &&
				col.numericScale !== null
			) {
				return `numeric(${col.numericPrecision},${col.numericScale})`;
			}
			if (col.numericPrecision !== null) {
				return `numeric(${col.numericPrecision})`;
			}
			return "numeric";
		}

		return col.udtName || dt;
	}

	showEmpty(): void {
		this.emptyEl.removeClass("pg-hidden");
		this.contentEl.addClass("pg-hidden");
	}

	showLoading(): void {
		this.emptyEl.addClass("pg-hidden");
		this.contentEl.removeClass("pg-hidden");
		this.contentEl.empty();
		this.contentEl.createEl("p", {
			text: "Loading schema details...",
			cls: "pg-muted",
		});
	}

	clear(): void {
		this.contentEl.empty();
		this.showEmpty();
	}
}

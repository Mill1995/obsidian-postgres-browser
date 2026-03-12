export class QueryEditor {
	private textareaEl: HTMLTextAreaElement;
	private runBtn: HTMLButtonElement;
	private statusEl: HTMLElement;
	private onRun: (query: string) => void;

	constructor(container: HTMLElement, onRun: (query: string) => void) {
		this.onRun = onRun;

		this.textareaEl = container.createEl("textarea", {
			cls: "pg-query-textarea",
			attr: {
				placeholder: "SELECT * FROM ...",
				rows: "6",
				spellcheck: "false",
			},
		});

		this.textareaEl.addEventListener("keydown", (e) => {
			if (e.key === "Tab") {
				e.preventDefault();
				const start = this.textareaEl.selectionStart;
				const end = this.textareaEl.selectionEnd;
				this.textareaEl.value =
					this.textareaEl.value.substring(0, start) +
					"  " +
					this.textareaEl.value.substring(end);
				this.textareaEl.selectionStart =
					this.textareaEl.selectionEnd = start + 2;
			}
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				this.run();
			}
		});

		const btnRow = container.createDiv({ cls: "pg-editor-btn-row" });

		this.runBtn = btnRow.createEl("button", {
			text: "Run Query",
			cls: "pg-run-btn mod-cta",
		});
		this.runBtn.addEventListener("click", () => this.run());

		this.statusEl = btnRow.createSpan({ cls: "pg-query-status" });
	}

	private run(): void {
		const query = this.textareaEl.value.trim();
		if (!query) return;
		this.onRun(query);
	}

	setStatus(text: string): void {
		this.statusEl.textContent = text;
	}

	setLoading(loading: boolean): void {
		this.runBtn.disabled = loading;
		this.runBtn.textContent = loading ? "Running..." : "Run Query";
	}
}

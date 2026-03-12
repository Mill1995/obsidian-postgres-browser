export class ResizeHandle {
	constructor(
		container: HTMLElement,
		sidebar: HTMLElement,
		minWidth = 160,
		maxWidth = 400
	) {
		const handle = container.createDiv({ cls: "pg-resize-handle" });

		let startX = 0;
		let startWidth = 0;

		const onMouseMove = (e: MouseEvent) => {
			const delta = e.clientX - startX;
			const newWidth = Math.min(
				maxWidth,
				Math.max(minWidth, startWidth + delta)
			);
			sidebar.style.width = `${newWidth}px`;
		};

		const onMouseUp = () => {
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mouseup", onMouseUp);
			document.body.removeClass("pg-resizing");
		};

		handle.addEventListener("mousedown", (e: MouseEvent) => {
			e.preventDefault();
			startX = e.clientX;
			startWidth = sidebar.offsetWidth;
			document.body.addClass("pg-resizing");
			document.addEventListener("mousemove", onMouseMove);
			document.addEventListener("mouseup", onMouseUp);
		});
	}
}

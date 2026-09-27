/** Редактирование/выделение остаются у браузера: перехват move способен сорвать drag каретки. */
export function isNativeTouchInteraction(documentTarget: Document, path: readonly EventTarget[]): boolean {
	const view = documentTarget.defaultView;
	if (!view) return true;
	let editableBoundarySeen = false;
	let target: Element | undefined;
	for (const entry of path) {
		if (!(entry instanceof view.Element)) continue;
		target ??= entry;
		if (entry.matches("input:not(:disabled), textarea:not(:disabled), select:not(:disabled), audio[controls], video[controls]")) {
			return true;
		}
		if (editableBoundarySeen) continue;
		const editable = entry.getAttribute("contenteditable")?.toLowerCase();
		if (editable === "" || editable === "true" || editable === "plaintext-only") return true;
		if (editable === "false") editableBoundarySeen = true;
	}
	const selection = documentTarget.getSelection();
	// Чужое выделение не отключает защиту заголовка/фона на всей странице.
	if (!target || !selection || selection.isCollapsed) return false;
	for (let index = 0; index < selection.rangeCount; index += 1) {
		if (selection.getRangeAt(index).intersectsNode(target)) return true;
	}
	return false;
}

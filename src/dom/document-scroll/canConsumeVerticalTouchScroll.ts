/** Проверяет обычную вложенную scroll-цепочку; корневой документ не является разрешённым host. */
export function canConsumeVerticalTouchScroll(documentTarget: Document, path: readonly EventTarget[], deltaY: number): boolean {
	const view = documentTarget.defaultView;
	if (!view) return true;
	for (const entry of path) {
		if (entry === documentTarget.body || entry === documentTarget.documentElement) break;
		if (!(entry instanceof view.Element) || !entry.isConnected) continue;
		const style = view.getComputedStyle(entry);
		if (!/^(auto|scroll|overlay)$/.test(style.overflowY)) continue;
		// Reverse/writing-mode layout имеет другую систему координат. В этом patch
		// не подменяем её предположением 0..max и не реализуем собственную scroll physics.
		if (style.flexDirection === "column-reverse" || (style.writingMode && style.writingMode !== "horizontal-tb")) return true;
		const maximum = Math.max(0, entry.scrollHeight - entry.clientHeight);
		const top = Math.max(0, Math.min(maximum, entry.scrollTop));
		// scrollTop дробный, а scrollHeight/clientHeight округлены: 1 CSS px
		// допуска перекрывает ложный остаток на физически достигнутом краю.
		if (deltaY > 0 ? maximum - top > 1 : top > 1) return true;
		// На краю contain/none движение не должно переходить к следующему ancestor.
		if (/^(contain|none)$/.test(style.overscrollBehaviorY)) return false;
	}
	return false;
}

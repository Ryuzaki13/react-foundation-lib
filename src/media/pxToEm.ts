import { getCurrentFontSize } from "./getCurrentFontSize";

export function pxToEm(px: number, baseEm?: number): string {
	const emSize = baseEm ?? getCurrentFontSize(); // динамическая привязка
	return (px / emSize).toString();
}

import { useEffect } from "react";

import { acquireDocumentScrollLock } from "./document-scroll/acquireDocumentScrollLock";
import { type UseDocumentScrollLockOptions } from "./document-scroll/documentScrollLockTypes";

/** Блокирует фоновую прокрутку до освобождения последнего потребителя; не управляет focus/inert. */
export function useDocumentScrollLock({ active, documentTarget, compensateScrollbar = false }: UseDocumentScrollLockOptions): void {
	useEffect(() => {
		if (!active) return;
		const target = documentTarget === undefined ? (typeof document === "undefined" ? null : document) : documentTarget;
		if (!target) return;
		return acquireDocumentScrollLock(target, compensateScrollbar);
	}, [active, documentTarget, compensateScrollbar]);
}

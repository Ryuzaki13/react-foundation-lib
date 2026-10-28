import { DOM_INSTANT_SCROLL_BEHAVIOR } from "../domScrollConstants";

import { attachDocumentTouchScrollGuard } from "./attachDocumentTouchScrollGuard";

// Имена принадлежащих lock CSS-свойств общие для снимка, применения и восстановления.
const OVERFLOW_PROPERTY = "overflow";
const OVERFLOW_X_PROPERTY = "overflow-x";
const OVERFLOW_Y_PROPERTY = "overflow-y";
const POSITION_PROPERTY = "position";
const TOP_PROPERTY = "top";
const LEFT_PROPERTY = "left";
const WIDTH_PROPERTY = "width";
const BOX_SIZING_PROPERTY = "box-sizing";
const PADDING_RIGHT_PROPERTY = "padding-right";
const HIDDEN_OVERFLOW_VALUE = "hidden";

type InlineProperty = Readonly<{ name: string; value: string; priority: string }>;

type DocumentScrollLock = Readonly<{
	leases: Map<symbol, boolean>;
	updateCompensation: () => void;
	restore: () => void;
}>;

const locks = new WeakMap<Document, DocumentScrollLock>();

/** Снимок ограничен принадлежащими lock свойствами, остальные inline-правки не затрагиваются. */
function captureProperties(style: CSSStyleDeclaration, names: readonly string[]): readonly InlineProperty[] {
	return names.map((name) => ({ name, value: style.getPropertyValue(name), priority: style.getPropertyPriority(name) }));
}

function restoreProperties(style: CSSStyleDeclaration, properties: readonly InlineProperty[]): void {
	// Сначала снимаем весь принадлежащий нам shorthand/longhand набор: иначе позднее
	// удаление пустого longhand может отменить только что восстановленный shorthand.
	for (const { name } of properties) style.removeProperty(name);
	for (const { name, value, priority } of properties) {
		if (value) style.setProperty(name, value, priority);
	}
}

/** Один владелец body/html на документ предотвращает преждевременный unlock вложенных overlays. */
export function acquireDocumentScrollLock(documentTarget: Document, compensateScrollbar: boolean): () => void {
	const view = documentTarget.defaultView;
	const body = documentTarget.body;
	if (!view || !body) return () => undefined;

	let lock = locks.get(documentTarget);
	if (!lock) {
		const rootStyle = documentTarget.documentElement.style;
		const bodyStyle = body.style;
		const rootProperties = captureProperties(rootStyle, [OVERFLOW_PROPERTY, OVERFLOW_X_PROPERTY, OVERFLOW_Y_PROPERTY]);
		const bodyProperties = captureProperties(bodyStyle, [
			POSITION_PROPERTY,
			TOP_PROPERTY,
			LEFT_PROPERTY,
			WIDTH_PROPERTY,
			OVERFLOW_PROPERTY,
			OVERFLOW_X_PROPERTY,
			OVERFLOW_Y_PROPERTY,
			BOX_SIZING_PROPERTY,
			PADDING_RIGHT_PROPERTY
		]);
		const originalPadding = captureProperties(bodyStyle, [PADDING_RIGHT_PROPERTY]);
		const scrollX = view.scrollX;
		const scrollY = view.scrollY;
		const scrollbarWidth = Math.max(0, view.innerWidth - documentTarget.documentElement.clientWidth);
		const computedPadding = Number.parseFloat(view.getComputedStyle(body).paddingRight) || 0;
		const leases = new Map<symbol, boolean>();

		// Fixed body нужен и при iOS visual-viewport pan: одного overflow hidden недостаточно.
		rootStyle.setProperty(OVERFLOW_PROPERTY, HIDDEN_OVERFLOW_VALUE);
		bodyStyle.setProperty(POSITION_PROPERTY, "fixed");
		bodyStyle.setProperty(TOP_PROPERTY, `${-scrollY}px`);
		bodyStyle.setProperty(LEFT_PROPERTY, `${-scrollX}px`);
		bodyStyle.setProperty(WIDTH_PROPERTY, "100%");
		bodyStyle.setProperty(OVERFLOW_PROPERTY, HIDDEN_OVERFLOW_VALUE);
		bodyStyle.setProperty(BOX_SIZING_PROPERTY, "border-box");
		const releaseTouchGuard = attachDocumentTouchScrollGuard(documentTarget);

		lock = {
			leases,
			updateCompensation: () => {
				if (scrollbarWidth > 0 && [...leases.values()].some(Boolean)) {
					bodyStyle.setProperty(PADDING_RIGHT_PROPERTY, `${computedPadding + scrollbarWidth}px`);
				} else restoreProperties(bodyStyle, originalPadding);
			},
			restore: () => {
				releaseTouchGuard();
				restoreProperties(rootStyle, rootProperties);
				restoreProperties(bodyStyle, bodyProperties);
				view.scrollTo({ left: scrollX, top: scrollY, behavior: DOM_INSTANT_SCROLL_BEHAVIOR });
			}
		};
		locks.set(documentTarget, lock);
	}

	const lease = Symbol();
	lock.leases.set(lease, compensateScrollbar);
	lock.updateCompensation();
	return () => {
		if (!lock.leases.delete(lease)) return;
		if (lock.leases.size > 0) lock.updateCompensation();
		else {
			locks.delete(documentTarget);
			lock.restore();
		}
	};
}

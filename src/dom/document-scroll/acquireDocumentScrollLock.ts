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
		const rootProperties = captureProperties(rootStyle, ["overflow", "overflow-x", "overflow-y"]);
		const bodyProperties = captureProperties(bodyStyle, [
			"position",
			"top",
			"left",
			"width",
			"overflow",
			"overflow-x",
			"overflow-y",
			"box-sizing",
			"padding-right"
		]);
		const originalPadding = captureProperties(bodyStyle, ["padding-right"]);
		const scrollX = view.scrollX;
		const scrollY = view.scrollY;
		const scrollbarWidth = Math.max(0, view.innerWidth - documentTarget.documentElement.clientWidth);
		const computedPadding = Number.parseFloat(view.getComputedStyle(body).paddingRight) || 0;
		const leases = new Map<symbol, boolean>();

		// Fixed body нужен и при iOS visual-viewport pan: одного overflow hidden недостаточно.
		rootStyle.setProperty("overflow", "hidden");
		bodyStyle.setProperty("position", "fixed");
		bodyStyle.setProperty("top", `${-scrollY}px`);
		bodyStyle.setProperty("left", `${-scrollX}px`);
		bodyStyle.setProperty("width", "100%");
		bodyStyle.setProperty("overflow", "hidden");
		bodyStyle.setProperty("box-sizing", "border-box");

		lock = {
			leases,
			updateCompensation: () => {
				if (scrollbarWidth > 0 && [...leases.values()].some(Boolean)) {
					bodyStyle.setProperty("padding-right", `${computedPadding + scrollbarWidth}px`);
				} else restoreProperties(bodyStyle, originalPadding);
			},
			restore: () => {
				restoreProperties(rootStyle, rootProperties);
				restoreProperties(bodyStyle, bodyProperties);
				view.scrollTo({ left: scrollX, top: scrollY, behavior: "instant" });
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

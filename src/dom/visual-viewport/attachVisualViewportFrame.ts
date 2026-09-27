const properties = ["--visual-viewport-top", "--visual-viewport-left", "--visual-viewport-width", "--visual-viewport-height"] as const;

const attachments = new WeakMap<HTMLElement, { leases: Set<symbol>; detach: () => void }>();

/** Подписка меняет CSS-переменные конкретной поверхности, не вызывает React render на каждом pan. */
function createVisualViewportFrame(container: HTMLElement): () => void {
	const view = container.ownerDocument.defaultView;
	if (!view) return () => undefined;
	const viewport = view.visualViewport;
	const style = container.style;
	const previous = properties.map((name) => ({ name, value: style.getPropertyValue(name), priority: style.getPropertyPriority(name) }));
	const ownedValues = new Map<string, string>();
	let frame = 0;

	const update = (): void => {
		frame = 0;
		const bounds = [
			viewport?.offsetTop ?? 0,
			viewport?.offsetLeft ?? 0,
			viewport?.width ?? view.innerWidth,
			viewport?.height ?? view.innerHeight
		];
		const fallback = [0, 0, view.innerWidth, view.innerHeight];
		properties.forEach((name, index) => {
			const value = `${Number.isFinite(bounds[index]) ? bounds[index] : fallback[index]}px`;
			if (ownedValues.get(name) === value) return;
			style.setProperty(name, value);
			ownedValues.set(name, value);
		});
	};

	const schedule = (): void => {
		if (!frame) frame = view.requestAnimationFrame(update);
	};

	update();
	viewport?.addEventListener("resize", schedule);
	viewport?.addEventListener("scroll", schedule);
	view.addEventListener("resize", schedule);
	return () => {
		view.cancelAnimationFrame(frame);
		viewport?.removeEventListener("resize", schedule);
		viewport?.removeEventListener("scroll", schedule);
		view.removeEventListener("resize", schedule);
		for (const { name, value, priority } of previous) {
			// Не затираем новое значение, если внешний owner уже забрал это CSS-свойство.
			if (style.getPropertyValue(name) !== ownedValues.get(name) || style.getPropertyPriority(name)) continue;
			if (value) style.setProperty(name, value, priority);
			else style.removeProperty(name);
		}
	};
}

/** Несколько модалок могут разделять portal-root; его frame снимается только последним owner. */
export function attachVisualViewportFrame(container: HTMLElement): () => void {
	let attachment = attachments.get(container);
	if (!attachment) {
		attachment = { leases: new Set(), detach: createVisualViewportFrame(container) };
		attachments.set(container, attachment);
	}
	const lease = Symbol();
	attachment.leases.add(lease);
	return () => {
		if (!attachment.leases.delete(lease) || attachment.leases.size > 0) return;
		attachments.delete(container);
		attachment.detach();
	};
}

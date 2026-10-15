/**
 * Временный SVG favicon с симметричным восстановлением атрибутов. Сохраняет
 * media исходных links; не меняет Apple/mask icons и не удаляет чужие узлы head.
 */
export function installFaviconOverride(document: Document, href: string): () => void {
	const icons = [...document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')];
	const snapshots = icons.map((icon) => ({
		icon,
		href: icon.getAttribute("href"),
		type: icon.getAttribute("type"),
		sizes: icon.getAttribute("sizes")
	}));
	for (const icon of icons) {
		icon.setAttribute("href", href);
		icon.setAttribute("type", "image/svg+xml");
		icon.setAttribute("sizes", "any");
	}
	return () => {
		for (const snapshot of snapshots) {
			if (snapshot.icon.getAttribute("href") !== href) continue;
			for (const attribute of ["href", "type", "sizes"] as const) {
				const value = snapshot[attribute];
				if (value === null) snapshot.icon.removeAttribute(attribute);
				else snapshot.icon.setAttribute(attribute, value);
			}
		}
	};
}

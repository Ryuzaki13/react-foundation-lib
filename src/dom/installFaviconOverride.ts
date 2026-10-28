// Снимок и восстановление используют один набор принадлежащих override атрибутов.
const ICON_HREF_ATTRIBUTE = "href";
const ICON_TYPE_ATTRIBUTE = "type";
const ICON_SIZES_ATTRIBUTE = "sizes";

/**
 * Временный SVG favicon с симметричным восстановлением атрибутов. Сохраняет
 * media исходных links; не меняет Apple/mask icons и не удаляет чужие узлы head.
 */
export function installFaviconOverride(document: Document, href: string): () => void {
	const icons = [...document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')];
	const snapshots = icons.map((icon) => ({
		icon,
		href: icon.getAttribute(ICON_HREF_ATTRIBUTE),
		type: icon.getAttribute(ICON_TYPE_ATTRIBUTE),
		sizes: icon.getAttribute(ICON_SIZES_ATTRIBUTE)
	}));
	for (const icon of icons) {
		icon.setAttribute(ICON_HREF_ATTRIBUTE, href);
		icon.setAttribute(ICON_TYPE_ATTRIBUTE, "image/svg+xml");
		icon.setAttribute(ICON_SIZES_ATTRIBUTE, "any");
	}
	return () => {
		for (const snapshot of snapshots) {
			if (snapshot.icon.getAttribute(ICON_HREF_ATTRIBUTE) !== href) continue;
			for (const attribute of [ICON_HREF_ATTRIBUTE, ICON_TYPE_ATTRIBUTE, ICON_SIZES_ATTRIBUTE] as const) {
				const value = snapshot[attribute];
				if (value === null) snapshot.icon.removeAttribute(attribute);
				else snapshot.icon.setAttribute(attribute, value);
			}
		}
	};
}

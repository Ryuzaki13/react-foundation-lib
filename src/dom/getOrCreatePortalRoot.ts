export function getOrCreatePortalRoot(id: string): HTMLElement | null {
	if (typeof document === "undefined") {
		return null;
	}

	const existingElement = document.getElementById(id);
	if (existingElement instanceof HTMLElement) {
		return existingElement;
	}

	const portalRoot = document.createElement("div");
	portalRoot.id = id;
	document.body.append(portalRoot);

	return portalRoot;
}

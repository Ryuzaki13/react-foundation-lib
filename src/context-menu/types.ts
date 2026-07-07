export interface MenuPoint {
	x: number;
	y: number;
}

export type MenuOpenSource = "click" | "contextmenu" | "keyboard" | "programmatic";

export interface ElementMenuAnchor {
	type: "element";
	element: HTMLElement;
}

export interface PointMenuAnchor {
	type: "point";
	point: MenuPoint;
	contextElement?: Element | null;
}

export type MenuAnchor = ElementMenuAnchor | PointMenuAnchor;

export interface MenuState {
	open: boolean;
	source: MenuOpenSource | null;
	anchor: MenuAnchor | null;
}

export interface OpenMenuPayload {
	source: MenuOpenSource;
	anchor: MenuAnchor;
}

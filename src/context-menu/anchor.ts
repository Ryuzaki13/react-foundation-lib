import { MenuPoint } from "./types";

interface MousePointLike {
	clientX: number;
	clientY: number;
}

interface RectLike {
	left: number;
	top: number;
	width: number;
	height: number;
}

export function getMenuPointFromEvent(event: MousePointLike): MenuPoint {
	return {
		x: event.clientX,
		y: event.clientY
	};
}

export function getMenuPointFromRect(rect: RectLike): MenuPoint {
	return {
		x: rect.left + rect.width / 2,
		y: rect.top + rect.height / 2
	};
}

export function createVirtualAnchor(point: MenuPoint, contextElement?: Element | null) {
	return {
		contextElement: contextElement ?? undefined,
		getBoundingClientRect: () =>
			({
				x: point.x,
				y: point.y,
				top: point.y,
				left: point.x,
				bottom: point.y,
				right: point.x,
				width: 0,
				height: 0,
				toJSON: () => {}
			}) as DOMRect
	};
}

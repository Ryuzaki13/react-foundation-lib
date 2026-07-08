import { MenuState, OpenMenuPayload } from "./types";

export const initialMenuState: MenuState = {
	open: false,
	source: null,
	anchor: null
};

export function openMenu(payload: OpenMenuPayload): MenuState {
	return {
		open: true,
		source: payload.source,
		anchor: payload.anchor
	};
}

export function closeMenu(state: MenuState): MenuState {
	if (!state.open && state.anchor === null) {
		return state;
	}

	return {
		open: false,
		source: null,
		anchor: null
	};
}

export function toggleMenu(state: MenuState, payload: OpenMenuPayload): MenuState {
	if (state.open) {
		return closeMenu(state);
	}

	return openMenu(payload);
}

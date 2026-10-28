import {
	THREE_SCENE_WEBGL_VERSION_1,
	THREE_SCENE_WEBGL_VERSION_2,
	THREE_SCENE_DISABLED_STORAGE_VALUE,
	type THREE_SCENE_STATUS_PENDING,
	type THREE_SCENE_STATUS_AVAILABLE,
	type THREE_SCENE_STATUS_UNAVAILABLE,
	type THREE_SCENE_REASON_SSR,
	type THREE_SCENE_REASON_SESSION_DISABLED,
	type THREE_SCENE_REASON_REDUCED_MOTION,
	type THREE_SCENE_REASON_WEBGL_UNSUPPORTED
} from "./threeSceneConstants";

export type ThreeSceneWebGLVersion = typeof THREE_SCENE_WEBGL_VERSION_1 | typeof THREE_SCENE_WEBGL_VERSION_2;

export type ThreeSceneAvailabilityStatus =
	typeof THREE_SCENE_STATUS_PENDING | typeof THREE_SCENE_STATUS_AVAILABLE | typeof THREE_SCENE_STATUS_UNAVAILABLE;

export type ThreeSceneUnavailableReason =
	| typeof THREE_SCENE_REASON_SSR
	| typeof THREE_SCENE_REASON_SESSION_DISABLED
	| typeof THREE_SCENE_REASON_REDUCED_MOTION
	| typeof THREE_SCENE_REASON_WEBGL_UNSUPPORTED;

export type ThreeSceneAvailability = {
	readonly status: ThreeSceneAvailabilityStatus;
	readonly reason?: ThreeSceneUnavailableReason;
};

export type ThreeSceneSupportOptions = {
	readonly webGLVersion?: ThreeSceneWebGLVersion;
};

type ThreeSceneWebGLContext = WebGLRenderingContext | WebGL2RenderingContext;

const webGLContextNames: Record<ThreeSceneWebGLVersion, readonly string[]> = {
	webgl: [THREE_SCENE_WEBGL_VERSION_2, THREE_SCENE_WEBGL_VERSION_1, "experimental-webgl"],
	webgl2: [THREE_SCENE_WEBGL_VERSION_2]
};

export const threeSceneDefaultDisabledStorageKey = `${__APP_ID__}:three-scene:disabled`;

export function isThreeSceneDisabledForSession(storageKey = threeSceneDefaultDisabledStorageKey): boolean {
	if (typeof window === "undefined") {
		return true;
	}

	try {
		return window.sessionStorage.getItem(storageKey) === THREE_SCENE_DISABLED_STORAGE_VALUE;
	} catch {
		return false;
	}
}

export function disableThreeSceneForSession(storageKey = threeSceneDefaultDisabledStorageKey) {
	if (typeof window === "undefined") {
		return;
	}

	try {
		window.sessionStorage.setItem(storageKey, THREE_SCENE_DISABLED_STORAGE_VALUE);
	} catch {
		// sessionStorage может быть недоступен в приватном режиме или при пользовательских политиках браузера.
	}
}

export function isThreeSceneSupported({ webGLVersion = THREE_SCENE_WEBGL_VERSION_2 }: ThreeSceneSupportOptions = {}): boolean {
	if (typeof document === "undefined") {
		return false;
	}

	try {
		const canvas = document.createElement("canvas");
		const contextNames = webGLContextNames[webGLVersion];

		for (const contextName of contextNames) {
			const context = canvas.getContext(contextName, {
				alpha: true,
				antialias: false,
				depth: true,
				stencil: false,
				powerPreference: "default"
			}) as ThreeSceneWebGLContext | null;

			if (!context) {
				continue;
			}

			const loseContext = context.getExtension("WEBGL_lose_context");
			loseContext?.loseContext();

			return true;
		}

		return false;
	} catch {
		return false;
	}
}

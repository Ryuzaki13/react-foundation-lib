export type ThreeSceneWebGLVersion = "webgl" | "webgl2";

export type ThreeSceneAvailabilityStatus = "pending" | "available" | "unavailable";

export type ThreeSceneUnavailableReason = "ssr" | "sessionDisabled" | "reducedMotion" | "webglUnsupported";

export type ThreeSceneAvailability = {
	readonly status: ThreeSceneAvailabilityStatus;
	readonly reason?: ThreeSceneUnavailableReason;
};

export type ThreeSceneSupportOptions = {
	readonly webGLVersion?: ThreeSceneWebGLVersion;
};

type ThreeSceneWebGLContext = WebGLRenderingContext | WebGL2RenderingContext;

const webGLContextNames: Record<ThreeSceneWebGLVersion, readonly string[]> = {
	webgl: ["webgl2", "webgl", "experimental-webgl"],
	webgl2: ["webgl2"]
};

export const threeSceneDefaultDisabledStorageKey = "ktk:three-scene:disabled";

export function isThreeSceneDisabledForSession(storageKey = threeSceneDefaultDisabledStorageKey): boolean {
	if (typeof window === "undefined") {
		return true;
	}

	try {
		return window.sessionStorage.getItem(storageKey) === "1";
	} catch {
		return false;
	}
}

export function disableThreeSceneForSession(storageKey = threeSceneDefaultDisabledStorageKey) {
	if (typeof window === "undefined") {
		return;
	}

	try {
		window.sessionStorage.setItem(storageKey, "1");
	} catch {
		// sessionStorage может быть недоступен в приватном режиме или при пользовательских политиках браузера.
	}
}

export function isThreeSceneSupported({ webGLVersion = "webgl2" }: ThreeSceneSupportOptions = {}): boolean {
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

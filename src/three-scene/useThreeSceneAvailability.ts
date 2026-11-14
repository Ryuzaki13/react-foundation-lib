import { useEffect, useState, useSyncExternalStore } from "react";

import { useMediaQuery } from "../media";

import {
	disableThreeSceneForSession,
	isThreeSceneDisabledForSession,
	isThreeSceneSupported,
	threeSceneDefaultDisabledStorageKey,
	type ThreeSceneAvailability,
	type ThreeSceneWebGLVersion
} from "./threeSceneAvailability";
import {
	THREE_SCENE_WEBGL_VERSION_2,
	THREE_SCENE_STATUS_AVAILABLE,
	THREE_SCENE_STATUS_UNAVAILABLE,
	THREE_SCENE_REASON_SSR,
	THREE_SCENE_REASON_SESSION_DISABLED,
	THREE_SCENE_REASON_REDUCED_MOTION,
	THREE_SCENE_REASON_WEBGL_UNSUPPORTED
} from "./threeSceneConstants";

export type UseThreeSceneAvailabilityOptions = {
	readonly disabledStorageKey?: string;
	readonly disableWhenReducedMotion?: boolean;
	readonly webGLVersion?: ThreeSceneWebGLVersion;
};

const serverAvailability: ThreeSceneAvailability = {
	status: THREE_SCENE_STATUS_UNAVAILABLE,
	reason: THREE_SCENE_REASON_SSR
};

function getServerAvailability(): ThreeSceneAvailability {
	return serverAvailability;
}

function checkBrowserAvailability(
	disabledStorageKey: string,
	webGLVersion: ThreeSceneWebGLVersion,
	reducedMotionDisablesScene: boolean
): ThreeSceneAvailability {
	if (reducedMotionDisablesScene) {
		return { status: THREE_SCENE_STATUS_UNAVAILABLE, reason: THREE_SCENE_REASON_REDUCED_MOTION };
	}

	if (isThreeSceneDisabledForSession(disabledStorageKey)) {
		return { status: THREE_SCENE_STATUS_UNAVAILABLE, reason: THREE_SCENE_REASON_SESSION_DISABLED };
	}

	if (!isThreeSceneSupported({ webGLVersion })) {
		disableThreeSceneForSession(disabledStorageKey);
		return { status: THREE_SCENE_STATUS_UNAVAILABLE, reason: THREE_SCENE_REASON_WEBGL_UNSUPPORTED };
	}

	return { status: THREE_SCENE_STATUS_AVAILABLE };
}

function createAvailabilityStore() {
	let snapshot = serverAvailability;
	const listeners = new Set<() => void>();

	return {
		getSnapshot: () => snapshot,
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		refresh(disabledStorageKey: string, webGLVersion: ThreeSceneWebGLVersion, reducedMotionDisablesScene: boolean) {
			const next = checkBrowserAvailability(disabledStorageKey, webGLVersion, reducedMotionDisablesScene);
			if (snapshot.status === next.status && snapshot.reason === next.reason) return;

			snapshot = next;
			for (const listener of listeners) listener();
		}
	};
}

export function useThreeSceneAvailability({
	disabledStorageKey = threeSceneDefaultDisabledStorageKey,
	disableWhenReducedMotion = false,
	webGLVersion = THREE_SCENE_WEBGL_VERSION_2
}: UseThreeSceneAvailabilityOptions = {}): ThreeSceneAvailability {
	const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
	const [availabilityStore] = useState(createAvailabilityStore);
	const availability = useSyncExternalStore(availabilityStore.subscribe, availabilityStore.getSnapshot, getServerAvailability);

	// Проверка создаёт временный WebGL-контекст и может записать флаг в sessionStorage.
	// Эффект синхронизирует эти браузерные данные, а при рендере читается готовый snapshot.
	useEffect(() => {
		availabilityStore.refresh(disabledStorageKey, webGLVersion, disableWhenReducedMotion && prefersReducedMotion);
	}, [availabilityStore, disableWhenReducedMotion, disabledStorageKey, prefersReducedMotion, webGLVersion]);

	return availability;
}

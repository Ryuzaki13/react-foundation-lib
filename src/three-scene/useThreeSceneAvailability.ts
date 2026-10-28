import { useEffect, useState } from "react";

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

export function useThreeSceneAvailability({
	disabledStorageKey = threeSceneDefaultDisabledStorageKey,
	disableWhenReducedMotion = false,
	webGLVersion = THREE_SCENE_WEBGL_VERSION_2
}: UseThreeSceneAvailabilityOptions = {}): ThreeSceneAvailability {
	const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
	const [availability, setAvailability] = useState<ThreeSceneAvailability>({
		status: THREE_SCENE_STATUS_UNAVAILABLE,
		reason: THREE_SCENE_REASON_SSR
	});

	useEffect(() => {
		if (disableWhenReducedMotion && prefersReducedMotion) {
			setAvailability({
				status: THREE_SCENE_STATUS_UNAVAILABLE,
				reason: THREE_SCENE_REASON_REDUCED_MOTION
			});
			return;
		}

		if (isThreeSceneDisabledForSession(disabledStorageKey)) {
			setAvailability({
				status: THREE_SCENE_STATUS_UNAVAILABLE,
				reason: THREE_SCENE_REASON_SESSION_DISABLED
			});
			return;
		}

		if (!isThreeSceneSupported({ webGLVersion })) {
			disableThreeSceneForSession(disabledStorageKey);
			setAvailability({
				status: THREE_SCENE_STATUS_UNAVAILABLE,
				reason: THREE_SCENE_REASON_WEBGL_UNSUPPORTED
			});
			return;
		}

		setAvailability({
			status: THREE_SCENE_STATUS_AVAILABLE
		});
	}, [disableWhenReducedMotion, disabledStorageKey, prefersReducedMotion, webGLVersion]);

	return availability;
}

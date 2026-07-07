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

export type UseThreeSceneAvailabilityOptions = {
	readonly disabledStorageKey?: string;
	readonly disableWhenReducedMotion?: boolean;
	readonly webGLVersion?: ThreeSceneWebGLVersion;
};

export function useThreeSceneAvailability({
	disabledStorageKey = threeSceneDefaultDisabledStorageKey,
	disableWhenReducedMotion = false,
	webGLVersion = "webgl2"
}: UseThreeSceneAvailabilityOptions = {}): ThreeSceneAvailability {
	const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
	const [availability, setAvailability] = useState<ThreeSceneAvailability>({
		status: "unavailable",
		reason: "ssr"
	});

	useEffect(() => {
		if (disableWhenReducedMotion && prefersReducedMotion) {
			setAvailability({
				status: "unavailable",
				reason: "reducedMotion"
			});
			return;
		}

		if (isThreeSceneDisabledForSession(disabledStorageKey)) {
			setAvailability({
				status: "unavailable",
				reason: "sessionDisabled"
			});
			return;
		}

		if (!isThreeSceneSupported({ webGLVersion })) {
			disableThreeSceneForSession(disabledStorageKey);
			setAvailability({
				status: "unavailable",
				reason: "webglUnsupported"
			});
			return;
		}

		setAvailability({
			status: "available"
		});
	}, [disableWhenReducedMotion, disabledStorageKey, prefersReducedMotion, webGLVersion]);

	return availability;
}

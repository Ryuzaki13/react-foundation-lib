/** Режим WebGL общий для публичного типа, набора context names и default options. */
export const THREE_SCENE_WEBGL_VERSION_1 = "webgl";
export const THREE_SCENE_WEBGL_VERSION_2 = "webgl2";

/** Статусы и причины имеют единые значения в публичных типах и browser hook. */
export const THREE_SCENE_STATUS_PENDING = "pending";
export const THREE_SCENE_STATUS_AVAILABLE = "available";
export const THREE_SCENE_STATUS_UNAVAILABLE = "unavailable";
export const THREE_SCENE_REASON_SSR = "ssr";
export const THREE_SCENE_REASON_SESSION_DISABLED = "sessionDisabled";
export const THREE_SCENE_REASON_REDUCED_MOTION = "reducedMotion";
export const THREE_SCENE_REASON_WEBGL_UNSUPPORTED = "webglUnsupported";

/** Значение sessionStorage должно совпадать при записи отказа и следующем чтении. */
export const THREE_SCENE_DISABLED_STORAGE_VALUE = "1";

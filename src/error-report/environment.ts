type ErrorReportEnvironmentOptions = {
	isDev?: boolean;
};

/**
 * Отчеты собираются только в браузере и только вне dev-режима.
 * На серверном рендеринге draft не создается, чтобы не смешивать SSR-ошибки с клиентской диагностикой.
 */
export function isErrorReportingEnabled(options: ErrorReportEnvironmentOptions = {}) {
	const isDev = options.isDev ?? __DEV__;

	return typeof window !== "undefined" && !isDev;
}

export function getErrorReportEnvironment() {
	const mode: "development" | "production" = __DEV__ ? "development" : "production";

	return {
		mode,
		buildId: typeof __APP_BUILD_ID__ === "string" ? __APP_BUILD_ID__ : undefined
	};
}

export function getErrorReportClientEnvironment() {
	if (typeof window === "undefined") return undefined;

	return {
		userAgent: window.navigator.userAgent,
		language: window.navigator.language,
		timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
	};
}

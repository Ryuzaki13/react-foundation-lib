import { useSyncExternalStore } from "react";

import { BREAKPOINTS_EM, type Breakpoint, type MediaMatches } from "./breakpoints";
import { getCurrentFontSize } from "./getCurrentFontSize";

/**
 * Публичный снимок состояния, который возвращает хук/store.
 * Содержит сырые совпадения media query и вычисленный активный брейкпоинт.
 */
type MatchMediaSnapshot = {
	matches: MediaMatches;
	activeBreakpoint: Breakpoint;
};

function subscribeMql(mql: MediaQueryList, cb: () => void) {
	if ("addEventListener" in mql) {
		mql.addEventListener("change", cb);
		return () => mql.removeEventListener("change", cb);
	}
	// Safari legacy
	// @ts-expect-error legacy api
	mql.addListener(cb);
	// @ts-expect-error legacy api
	return () => mql.removeListener(cb);
}

function buildQueriesPx(emSize: number) {
	const toPx = (em: number) => em * emSize;

	const mobileMax = toPx(BREAKPOINTS_EM.mobileMax);
	const tabletMin = toPx(BREAKPOINTS_EM.tabletMin);
	const tabletMax = toPx(BREAKPOINTS_EM.tabletMax);
	const laptopMin = toPx(BREAKPOINTS_EM.laptopMin);

	return {
		mobile: `(width <= ${mobileMax}px)`,
		tablet: `(width >= ${tabletMin}px) and (width <= ${tabletMax}px)`,
		laptop: `(width >= ${laptopMin}px)`
	} satisfies Record<Breakpoint, string>;
}

const DEFAULT_MATCHES: MediaMatches = {
	mobile: false,
	tablet: false,
	laptop: false
};

const DEFAULT_SNAPSHOT: MatchMediaSnapshot = {
	matches: DEFAULT_MATCHES,
	activeBreakpoint: "laptop"
};

/**
 * Игнорируем микроколебания `em`, чтобы не перестраивать media query без необходимости.
 */
const EM_CHANGE_THRESHOLD = 0.25;
/**
 * Склеиваем частые события observer-ов в одно перестроение.
 */
const EM_REBUILD_DEBOUNCE_MS = 80;

let snapshot: MatchMediaSnapshot = DEFAULT_SNAPSHOT;
let currentMql: Record<Breakpoint, MediaQueryList> | null = null;
let mqlUnsubs: Array<() => void> = [];
let emSizeRef = 0;
let initialized = false;
let mutationObserver: MutationObserver | null = null;
let resizeObserver: ResizeObserver | null = null;
let emProbeElement: HTMLDivElement | null = null;
let rebuildTimer: ReturnType<typeof setTimeout> | null = null;

const listeners = new Set<() => void>();

/**
 * Выбирает один активный брейкпоинт по приоритету: mobile -> tablet -> laptop.
 */
function getActiveBreakpoint(matches: MediaMatches): Breakpoint {
	if (matches.mobile) return "mobile";
	if (matches.tablet) return "tablet";
	return "laptop";
}

/**
 * Поверхностное сравнение media-состояния, чтобы пропускать пустые уведомления.
 */
function matchesEqual(a: MediaMatches, b: MediaMatches) {
	return a.mobile === b.mobile && a.tablet === b.tablet && a.laptop === b.laptop;
}

/**
 * Обновляет глобальный snapshot и уведомляет подписчиков только при реальных изменениях.
 */
function emitIfChanged(nextMatches: MediaMatches) {
	if (matchesEqual(snapshot.matches, nextMatches)) return;
	snapshot = {
		matches: nextMatches,
		activeBreakpoint: getActiveBreakpoint(nextMatches)
	};
	listeners.forEach((listener) => listener());
}

/**
 * Читает текущие значения `MediaQueryList` и публикует новый snapshot.
 */
function recomputeFromMql() {
	if (!currentMql) return;

	emitIfChanged({
		mobile: currentMql.mobile.matches,
		tablet: currentMql.tablet.matches,
		laptop: currentMql.laptop.matches
	});
}

/**
 * Снимает активные mql-подписки перед перестроением/очисткой.
 */
function clearMqlSubscriptions() {
	mqlUnsubs.forEach((unsubscribe) => unsubscribe());
	mqlUnsubs = [];
}

/**
 * Перестраивает media query, когда корневой `em` изменился достаточно сильно (или принудительно).
 * Это дорогой путь, поэтому он специально ограничен проверками.
 */
function rebuildIfEmChanged(force = false) {
	if (typeof window === "undefined" || typeof document === "undefined") return;

	const em = getCurrentFontSize();
	if (!force && currentMql && Math.abs(em - emSizeRef) < EM_CHANGE_THRESHOLD) return;

	emSizeRef = em;
	clearMqlSubscriptions();

	const queries = buildQueriesPx(em);
	currentMql = {
		mobile: window.matchMedia(queries.mobile),
		tablet: window.matchMedia(queries.tablet),
		laptop: window.matchMedia(queries.laptop)
	};

	mqlUnsubs = (Object.keys(currentMql) as Breakpoint[]).map((key) => subscribeMql(currentMql![key], recomputeFromMql));
	recomputeFromMql();
}

/**
 * Дебаунс-обертка для перестроения query по событиям observer-ов.
 */
function scheduleRebuild() {
	if (rebuildTimer) clearTimeout(rebuildTimer);
	rebuildTimer = setTimeout(() => {
		rebuildTimer = null;
		rebuildIfEmChanged();
	}, EM_REBUILD_DEBOUNCE_MS);
}

/**
 * Наблюдает за изменением style/class у root и размером probe-элемента `1em`.
 * Это позволяет ловить изменения font-size/zoom без слушателя window resize.
 */
function setupEmObservers() {
	if (typeof window === "undefined" || typeof document === "undefined") return;

	mutationObserver = new MutationObserver(scheduleRebuild);
	mutationObserver.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["style", "class", "data-font-size"]
	});

	if (typeof ResizeObserver === "undefined") return;

	emProbeElement = document.createElement("div");
	emProbeElement.style.position = "absolute";
	emProbeElement.style.visibility = "hidden";
	emProbeElement.style.pointerEvents = "none";
	emProbeElement.style.width = "1em";
	emProbeElement.style.height = "1px";
	emProbeElement.style.overflow = "hidden";
	emProbeElement.setAttribute("aria-hidden", "true");

	(document.body ?? document.documentElement).appendChild(emProbeElement);

	resizeObserver = new ResizeObserver(scheduleRebuild);
	resizeObserver.observe(emProbeElement);
}

/**
 * Полностью освобождает глобальные ресурсы, когда не осталось подписчиков.
 */
function cleanupStore() {
	clearMqlSubscriptions();
	currentMql = null;

	if (rebuildTimer) {
		clearTimeout(rebuildTimer);
		rebuildTimer = null;
	}

	if (mutationObserver) {
		mutationObserver.disconnect();
		mutationObserver = null;
	}

	if (resizeObserver) {
		resizeObserver.disconnect();
		resizeObserver = null;
	}

	if (emProbeElement?.parentNode) {
		emProbeElement.parentNode.removeChild(emProbeElement);
	}
	emProbeElement = null;

	initialized = false;
}

/**
 * Лениво инициализирует singleton-store при первом подписчике.
 */
function initializeStore() {
	if (initialized) return;
	if (typeof window === "undefined" || typeof document === "undefined") return;

	initialized = true;
	rebuildIfEmChanged(true);
	setupEmObservers();
}

/**
 * API подписки для `useSyncExternalStore`.
 * Держит ровно один глобальный набор observer-ов и mql на всё приложение.
 */
function subscribeStore(listener: () => void) {
	if (typeof window === "undefined" || typeof document === "undefined") {
		return () => {};
	}

	listeners.add(listener);
	initializeStore();

	return () => {
		listeners.delete(listener);
		if (listeners.size === 0) {
			cleanupStore();
		}
	};
}

/**
 * Getter клиентского snapshot для `useSyncExternalStore`.
 */
function getSnapshot() {
	return snapshot;
}

/**
 * SSR-безопасный getter snapshot.
 */
function getServerSnapshot() {
	return DEFAULT_SNAPSHOT;
}

/**
 * Общий хук брейкпоинтов, работающий через singleton external store.
 */
export function useMatchMedia() {
	return useSyncExternalStore(subscribeStore, getSnapshot, getServerSnapshot);
}

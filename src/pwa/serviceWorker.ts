import { logError } from "../utils";
import { isRecord } from "../validators";

const SW_BASE = __PREVIEW__ ? "/" : "/arm/";
const SW_URL = `${SW_BASE}sw.js`;
const SW_ACTIVATED_BY_CLIENT_MESSAGE_TYPE = "SW_ACTIVATED_BY_CLIENT";
// TODO: Vite env
const SW_UPDATE_RELOAD_COUNT_KEY = "arm.service-worker.update-reload-count.v1";
// TODO: Vite env
const MAX_SW_AUTO_UPDATE_RELOADS = 5;

type SWUpdateHandler = (reg: ServiceWorkerRegistration) => void;

type ServiceWorkerClientMessage = {
	type: typeof SW_ACTIVATED_BY_CLIENT_MESSAGE_TYPE;
};

type RegisterSWOptions = {
	/**
	 * Вызывается, когда новый SW установлен и ждёт активации.
	 */
	onUpdate?: SWUpdateHandler;

	/**
	 * Вызывается после успешной регистрации.
	 */
	onReady?: (reg: ServiceWorkerRegistration) => void;
};

const observedRegistrations = new WeakSet<ServiceWorkerRegistration>();
const updateHandlers = new Set<SWUpdateHandler>();

let latestRegistration: ServiceWorkerRegistration | null = null;
let refreshing = false;
let updateRequested = false;
let controllerChangeSubscribed = false;
let serviceWorkerMessageSubscribed = false;

function readServiceWorkerClientMessage(value: unknown): ServiceWorkerClientMessage | null {
	if (!isRecord(value)) return null;

	return value.type === SW_ACTIVATED_BY_CLIENT_MESSAGE_TYPE ? { type: SW_ACTIVATED_BY_CLIENT_MESSAGE_TYPE } : null;
}

function readServiceWorkerUpdateReloadCount(): number {
	try {
		const value = window.sessionStorage.getItem(SW_UPDATE_RELOAD_COUNT_KEY);
		const count = Number(value);

		return Number.isInteger(count) && count > 0 ? count : 0;
	} catch {
		return 0;
	}
}

export function recordServiceWorkerUpdateReload() {
	try {
		const nextCount = Math.min(readServiceWorkerUpdateReloadCount() + 1, MAX_SW_AUTO_UPDATE_RELOADS);
		window.sessionStorage.setItem(SW_UPDATE_RELOAD_COUNT_KEY, String(nextCount));
	} catch {
		/**
		 * sessionStorage может быть недоступен в приватном режиме или при
		 * жёстких browser policy. Обновление всё равно должно продолжиться.
		 */
	}
}

export function canAutoApplyServiceWorkerUpdate(): boolean {
	return readServiceWorkerUpdateReloadCount() < MAX_SW_AUTO_UPDATE_RELOADS;
}

export function clearServiceWorkerUpdateReloadChain() {
	try {
		window.sessionStorage.removeItem(SW_UPDATE_RELOAD_COUNT_KEY);
	} catch {
		/**
		 * Очистка маркера не критична: максимум пользователь увидит обычный
		 * баннер вместо автоматического продолжения цепочки обновлений.
		 */
	}
}

function reloadPage() {
	if (refreshing) return;

	refreshing = true;
	window.location.reload();
}

function subscribeControllerChangeReload() {
	if (controllerChangeSubscribed) return;

	controllerChangeSubscribed = true;

	navigator.serviceWorker.addEventListener("controllerchange", () => {
		/**
		 * Не перезагружаем страницу от любого controllerchange.
		 * Перезагрузка нужна только когда мы сами вызвали SKIP_WAITING.
		 */
		if (!updateRequested) return;

		reloadPage();
	});
}

function subscribeServiceWorkerMessages() {
	if (serviceWorkerMessageSubscribed) return;

	serviceWorkerMessageSubscribed = true;

	navigator.serviceWorker.addEventListener("message", (event) => {
		const message = readServiceWorkerClientMessage(event.data);
		if (!message) return;
		if (refreshing) return;

		recordServiceWorkerUpdateReload();
		reloadPage();
	});
}

function emitUpdate(reg: ServiceWorkerRegistration) {
	for (const handler of updateHandlers) {
		handler(reg);
	}
}

function observeRegistration(reg: ServiceWorkerRegistration) {
	if (observedRegistrations.has(reg)) return;

	observedRegistrations.add(reg);

	reg.addEventListener("updatefound", () => {
		const newWorker = reg.installing;
		if (!newWorker) return;

		newWorker.addEventListener("statechange", () => {
			/**
			 * installed + есть controller = новая версия установлена,
			 * но текущая страница всё ещё под старым SW.
			 */
			if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
				latestRegistration = reg;
				emitUpdate(reg);
			}
		});
	});

	subscribeControllerChangeReload();
	subscribeServiceWorkerMessages();
}

export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
	if (!("serviceWorker" in navigator)) return null;

	try {
		const reg = latestRegistration ?? (await navigator.serviceWorker.getRegistration(SW_BASE));

		if (!reg) return null;

		latestRegistration = reg;
		observeRegistration(reg);

		return reg;
	} catch (err) {
		logError("[SW] get registration failed:", err);
		return null;
	}
}

export async function registerServiceWorker(options: RegisterSWOptions = {}) {
	if (!("serviceWorker" in navigator)) return null;

	if (options.onUpdate) {
		updateHandlers.add(options.onUpdate);
	}

	try {
		const existingRegistration = latestRegistration ?? (await navigator.serviceWorker.getRegistration(SW_BASE));

		const reg =
			existingRegistration ??
			(await navigator.serviceWorker.register(SW_URL, {
				scope: SW_BASE,
				updateViaCache: "none"
			}));

		latestRegistration = reg;
		observeRegistration(reg);

		options.onReady?.(reg);

		return reg;
	} catch (err) {
		logError("[SW] registration failed:", err);
		return null;
	}
}

export function unsubscribeServiceWorkerUpdate(handler: SWUpdateHandler) {
	updateHandlers.delete(handler);
}

export function hasWaitingServiceWorker(reg: ServiceWorkerRegistration | null | undefined): reg is ServiceWorkerRegistration {
	return Boolean(reg?.waiting);
}

export function applyServiceWorkerUpdate(reg: ServiceWorkerRegistration | null = latestRegistration) {
	const waiting = reg?.waiting;
	if (!waiting) return false;

	updateRequested = true;
	recordServiceWorkerUpdateReload();

	waiting.postMessage({ type: "SKIP_WAITING" });

	return true;
}

export function reloadPageForServiceWorkerUpdate() {
	recordServiceWorkerUpdateReload();
	reloadPage();

	return true;
}

export async function checkServiceWorkerUpdate() {
	if (!("serviceWorker" in navigator)) return null;

	try {
		const reg = latestRegistration ?? (await navigator.serviceWorker.getRegistration(SW_BASE));
		if (!reg) return null;

		latestRegistration = reg;
		observeRegistration(reg);

		await reg.update();

		return reg;
	} catch (err) {
		logError("[SW] update check failed:", err);
		return null;
	}
}

/**
 * Очищает SW-кеш OData для указанной политики.
 *
 * Примеры: `"ttl=24h;name=ref"`, `"ttl=10m;max=200;name=ui"`.
 *
 * После вызова следующий запрос с той же политикой пойдёт в сеть.
 */
export function invalidateSwCacheProfile(profile: string) {
	navigator.serviceWorker?.controller?.postMessage({
		type: "invalidateProfile",
		profile
	});
}

// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import {
	applyServiceWorkerUpdate,
	canAutoApplyServiceWorkerUpdate,
	checkServiceWorkerUpdate,
	clearServiceWorkerUpdateReloadChain,
	getServiceWorkerRegistration,
	hasWaitingServiceWorker,
	invalidateSwCacheProfile,
	recordServiceWorkerUpdateReload,
	registerServiceWorker,
	unsubscribeServiceWorkerUpdate
} from "./serviceWorker";

type FakeWorker = ServiceWorker & {
	postMessage: ReturnType<typeof vi.fn>;
	setState: (state: ServiceWorkerState) => void;
};

type FakeRegistration = ServiceWorkerRegistration & {
	emitUpdateFound: () => void;
	update: ReturnType<typeof vi.fn<() => Promise<void>>>;
};

type FakeServiceWorkerContainer = ServiceWorkerContainer & {
	controller: ServiceWorker | null;
	getRegistration: ReturnType<typeof vi.fn<(scope?: string) => Promise<ServiceWorkerRegistration | undefined>>>;
	register: ReturnType<typeof vi.fn<(scriptURL: string | URL, options?: RegistrationOptions) => Promise<ServiceWorkerRegistration>>>;
	emitMessage: (data: unknown) => void;
	emitControllerChange: () => void;
};

function createFakeWorker(initialState: ServiceWorkerState = "installing"): FakeWorker {
	let state = initialState;
	const listeners: EventListener[] = [];

	return {
		get state() {
			return state;
		},
		postMessage: vi.fn(),
		setState(nextState: ServiceWorkerState) {
			state = nextState;
			for (const listener of listeners) {
				listener(new Event("statechange"));
			}
		},
		addEventListener(type: string, listener: EventListener) {
			if (type === "statechange") {
				listeners.push(listener);
			}
		}
	} as unknown as FakeWorker;
}

function createFakeRegistration(options: { installing?: FakeWorker | null; waiting?: FakeWorker | null } = {}): FakeRegistration {
	let updateFoundListener: EventListener | undefined;

	return {
		installing: options.installing ?? null,
		waiting: options.waiting ?? null,
		update: vi.fn(async () => undefined),
		addEventListener(type: string, listener: EventListener) {
			if (type === "updatefound") {
				updateFoundListener = listener;
			}
		},
		emitUpdateFound() {
			updateFoundListener?.(new Event("updatefound"));
		}
	} as unknown as FakeRegistration;
}

function installServiceWorkerRuntime(): FakeServiceWorkerContainer {
	const listeners = new Map<string, EventListener[]>();
	const controller = createFakeWorker("activated");
	const runtime = {
		controller,
		getRegistration: vi.fn(async () => undefined),
		register: vi.fn(),
		addEventListener(type: string, listener: EventListener) {
			listeners.set(type, [...(listeners.get(type) ?? []), listener]);
		},
		emitMessage(data: unknown) {
			for (const listener of listeners.get("message") ?? []) {
				listener(new MessageEvent("message", { data }));
			}
		},
		emitControllerChange() {
			for (const listener of listeners.get("controllerchange") ?? []) {
				listener(new Event("controllerchange"));
			}
		}
	} as unknown as FakeServiceWorkerContainer;

	Object.defineProperty(navigator, "serviceWorker", {
		configurable: true,
		value: runtime
	});

	return runtime;
}

describe("serviceWorker update flow", () => {
	afterEach(() => {
		clearServiceWorkerUpdateReloadChain();
		vi.restoreAllMocks();
		Reflect.deleteProperty(navigator, "serviceWorker");
	});

	it("ограничивает цепочку автоматических reload после обновления", () => {
		expect(canAutoApplyServiceWorkerUpdate()).toBe(true);

		recordServiceWorkerUpdateReload();
		recordServiceWorkerUpdateReload();
		recordServiceWorkerUpdateReload();
		recordServiceWorkerUpdateReload();
		recordServiceWorkerUpdateReload();

		expect(canAutoApplyServiceWorkerUpdate()).toBe(false);
	});

	it("сбрасывает маркер цепочки после стабильного старта", () => {
		recordServiceWorkerUpdateReload();

		clearServiceWorkerUpdateReloadChain();

		expect(canAutoApplyServiceWorkerUpdate()).toBe(true);
	});

	it("возвращает null, если serviceWorker API недоступен", async () => {
		Reflect.deleteProperty(navigator, "serviceWorker");

		await expect(getServiceWorkerRegistration()).resolves.toBeNull();
		await expect(registerServiceWorker()).resolves.toBeNull();
		await expect(checkServiceWorkerUpdate()).resolves.toBeNull();
	});

	it("регистрирует SW, вызывает onReady и сообщает onUpdate при installed worker", async () => {
		const runtime = installServiceWorkerRuntime();
		const installing = createFakeWorker();
		const registration = createFakeRegistration({ installing });
		const onReady = vi.fn();
		const onUpdate = vi.fn();

		runtime.getRegistration.mockResolvedValue(undefined);
		runtime.register.mockResolvedValue(registration);

		await expect(registerServiceWorker({ onReady, onUpdate })).resolves.toBe(registration);

		expect(runtime.register).toHaveBeenCalledWith("/arm/sw.js", {
			scope: "/arm/",
			updateViaCache: "none"
		});
		expect(onReady).toHaveBeenCalledWith(registration);

		registration.emitUpdateFound();
		installing.setState("installed");

		expect(onUpdate).toHaveBeenCalledWith(registration);

		unsubscribeServiceWorkerUpdate(onUpdate);
		registration.emitUpdateFound();
		installing.setState("installed");

		expect(onUpdate).toHaveBeenCalledTimes(1);
	});

	it("использует существующую регистрацию и запускает update check", async () => {
		const runtime = installServiceWorkerRuntime();
		const registration = createFakeRegistration();
		runtime.getRegistration.mockResolvedValue(registration);

		const activeRegistration = (await getServiceWorkerRegistration()) as FakeRegistration | null;
		await expect(checkServiceWorkerUpdate()).resolves.toBe(activeRegistration);

		expect(activeRegistration?.update).toHaveBeenCalledOnce();
	});

	it("применяет waiting worker через SKIP_WAITING и записывает reload-chain", () => {
		const waiting = createFakeWorker("installed");
		const registration = createFakeRegistration({ waiting });

		expect(hasWaitingServiceWorker(registration)).toBe(true);
		expect(applyServiceWorkerUpdate(registration)).toBe(true);
		expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
		expect(canAutoApplyServiceWorkerUpdate()).toBe(true);
		expect(applyServiceWorkerUpdate(createFakeRegistration())).toBe(false);
		expect(hasWaitingServiceWorker(null)).toBe(false);
	});

	it("отправляет invalidateProfile в активный controller", () => {
		const runtime = installServiceWorkerRuntime();

		invalidateSwCacheProfile("ttl=24h;name=ref");

		expect(runtime.controller?.postMessage).toHaveBeenCalledWith({
			type: "invalidateProfile",
			profile: "ttl=24h;name=ref"
		});
	});

	it("использует существующую регистрацию без повторного register", async () => {
		vi.resetModules();
		const runtime = installServiceWorkerRuntime();
		const registration = createFakeRegistration();
		const onReady = vi.fn();
		const { registerServiceWorker: registerFreshServiceWorker } = await import("./serviceWorker");

		runtime.getRegistration.mockResolvedValue(registration);

		await expect(registerFreshServiceWorker({ onReady })).resolves.toBe(registration);

		expect(runtime.register).not.toHaveBeenCalled();
		expect(onReady).toHaveBeenCalledWith(registration);
	});

	it("возвращает null при ошибках регистрации и проверки обновления", async () => {
		vi.resetModules();
		const runtime = installServiceWorkerRuntime();
		const error = new Error("sw failed");
		const {
			checkServiceWorkerUpdate: checkFreshServiceWorkerUpdate,
			getServiceWorkerRegistration: getFreshServiceWorkerRegistration,
			registerServiceWorker: registerFreshServiceWorker
		} = await import("./serviceWorker");

		runtime.getRegistration.mockRejectedValue(error);

		await expect(getFreshServiceWorkerRegistration()).resolves.toBeNull();
		await expect(registerFreshServiceWorker()).resolves.toBeNull();
		await expect(checkFreshServiceWorkerUpdate()).resolves.toBeNull();
	});

	it("не сообщает update без installing worker или без активного controller", async () => {
		vi.resetModules();
		const runtime = installServiceWorkerRuntime();
		const registrationWithoutInstalling = createFakeRegistration();
		const installing = createFakeWorker();
		const registrationWithoutController = createFakeRegistration({ installing });
		const onUpdate = vi.fn();
		const { registerServiceWorker: registerFreshServiceWorker } = await import("./serviceWorker");

		runtime.getRegistration.mockResolvedValueOnce(registrationWithoutInstalling).mockResolvedValueOnce(registrationWithoutController);

		await registerFreshServiceWorker({ onUpdate });
		registrationWithoutInstalling.emitUpdateFound();
		expect(onUpdate).not.toHaveBeenCalled();

		Reflect.deleteProperty(navigator, "serviceWorker");
		const runtimeWithoutController = installServiceWorkerRuntime();
		runtimeWithoutController.controller = null;
		runtimeWithoutController.getRegistration.mockResolvedValue(registrationWithoutController);

		await registerFreshServiceWorker({ onUpdate });
		registrationWithoutController.emitUpdateFound();
		installing.setState("installed");

		expect(onUpdate).not.toHaveBeenCalled();
	});

	it("применяет waiting worker из последней регистрации по умолчанию", async () => {
		vi.resetModules();
		const runtime = installServiceWorkerRuntime();
		const waiting = createFakeWorker("installed");
		const registration = createFakeRegistration({ waiting });
		const { applyServiceWorkerUpdate: applyFreshServiceWorkerUpdate, registerServiceWorker: registerFreshServiceWorker } =
			await import("./serviceWorker");

		runtime.getRegistration.mockResolvedValue(registration);

		await registerFreshServiceWorker();

		expect(applyFreshServiceWorkerUpdate()).toBe(true);
		expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
	});
});

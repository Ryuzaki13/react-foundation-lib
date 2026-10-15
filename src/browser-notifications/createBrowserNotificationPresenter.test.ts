// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createBrowserNotificationPresenter } from "./index";

const request = { title: "Заголовок", body: "Содержимое", tag: "test:1", url: "/channel" };
const close = vi.fn();
const listeners = new Map<string, () => void>();
const constructor = vi.fn();
const requestPermission = vi.fn();
const getRegistration = vi.fn();
const onError = vi.fn();
const onOpen = vi.fn();

class TestNotification {
	static permission: NotificationPermission = "granted";
	static requestPermission = requestPermission;
	close = close;
	addEventListener = (name: string, listener: () => void) => listeners.set(name, listener);
	constructor(title: string, options: NotificationOptions) {
		constructor(title, options);
	}
}

beforeEach(() => {
	vi.clearAllMocks();
	listeners.clear();
	TestNotification.permission = "granted";
	vi.stubGlobal("Notification", TestNotification);
	vi.stubGlobal("isSecureContext", true);
	Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { getRegistration } });
	getRegistration.mockResolvedValue(undefined);
});

afterEach(() => {
	vi.unstubAllGlobals();
	Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("browser notification presenter", () => {
	it("не запрашивает разрешение и не создаёт уведомление при создании", () => {
		const presenter = createBrowserNotificationPresenter({ onError, onOpen });
		expect(presenter.permission()).toBe("granted");
		expect(requestPermission).not.toHaveBeenCalled();
		expect(constructor).not.toHaveBeenCalled();
		presenter.dispose();
	});
	it("не запрашивает повторно denied и не публикует без разрешения", async () => {
		TestNotification.permission = "denied";
		const presenter = createBrowserNotificationPresenter({ onError, onOpen });
		expect(await presenter.requestPermission()).toBe("denied");
		presenter.show(request)();
		expect(requestPermission).not.toHaveBeenCalled();
		expect(getRegistration).not.toHaveBeenCalled();
	});
	it("явная команда запрашивает default; insecure/unsupported не вызывает API", async () => {
		TestNotification.permission = "default";
		requestPermission.mockResolvedValue("granted");
		const presenter = createBrowserNotificationPresenter({ onError, onOpen });
		expect(await presenter.requestPermission()).toBe("granted");
		vi.stubGlobal("isSecureContext", false);
		expect(await presenter.requestPermission()).toBe("unsupported");
		expect(requestPermission).toHaveBeenCalledOnce();
	});
	it("native click открывает same-origin URL один раз; cleanup закрывает только своё уведомление", async () => {
		const presenter = createBrowserNotificationPresenter({ onError, onOpen });
		vi.spyOn(window, "focus").mockImplementation(() => undefined);
		presenter.show(request);
		await vi.waitFor(() => expect(constructor).toHaveBeenCalledOnce());
		listeners.get("click")?.();
		listeners.get("click")?.();
		expect(onOpen).toHaveBeenCalledExactlyOnceWith(new URL(request.url, location.href).href);
		expect(close).toHaveBeenCalledOnce();
		presenter.dispose();
	});
	it("не допускает позднюю публикацию после release/dispose", async () => {
		const pending = Promise.withResolvers<undefined>();
		getRegistration.mockReturnValue(pending.promise);
		const presenter = createBrowserNotificationPresenter({ onError, onOpen });
		presenter.show(request)();
		presenter.show({ ...request, tag: "test:2" });
		presenter.dispose();
		pending.resolve(undefined);
		await pending.promise;
		await Promise.resolve();
		expect(constructor).not.toHaveBeenCalled();
	});
	it("SW delivery снимается после отмены незавершённого show и не закрывает чужой tag publication", async () => {
		const pending = Promise.withResolvers<void>();
		let options: NotificationOptions | undefined;
		const ownClose = vi.fn();
		const foreignClose = vi.fn();
		const showNotification = vi.fn((_title: string, value: NotificationOptions) => {
			options = value;
			return pending.promise;
		});
		const getNotifications = vi.fn(async () => [
			{ data: options?.data, close: ownClose },
			{ data: { publicationId: "other" }, close: foreignClose }
		]);
		getRegistration.mockResolvedValue({ active: {}, showNotification, getNotifications });
		const presenter = createBrowserNotificationPresenter({ onError, onOpen });
		const release = presenter.show(request);
		await vi.waitFor(() => expect(showNotification).toHaveBeenCalledOnce());
		release();
		pending.resolve();
		await vi.waitFor(() => expect(ownClose).toHaveBeenCalledOnce());
		expect(foreignClose).not.toHaveBeenCalled();
		expect(constructor).not.toHaveBeenCalled();
	});
	it("сообщает об ошибке без unhandled rejection и запрещает чужой origin", async () => {
		const failure = new Error("Недоступен backend ОС");
		getRegistration.mockRejectedValue(failure);
		const presenter = createBrowserNotificationPresenter({ onError, onOpen });
		presenter.show(request);
		await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(failure));
		expect(() => presenter.show({ ...request, url: "https://foreign.example/path" })).toThrow();
		presenter.dispose();
	});
});

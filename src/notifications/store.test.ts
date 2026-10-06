// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { bindNotifications, notify } from "./notify";
import { createNotificationsStore } from "./store";

afterEach(() => {
	vi.useRealTimers();
});

describe("notifications store", () => {
	it("сохраняет action для ручного пользовательского действия", () => {
		const store = createNotificationsStore();
		const onClick = vi.fn();

		const id = store.getState().actions.push({
			type: "error",
			message: "Ошибка",
			ttlMs: 0,
			actions: [{ label: "Отправить отчет", onClick, tone: "error" }]
		});

		const notification = store.getState().items.find((item) => item.id === id);
		notification?.actions?.[0]?.onClick();

		expect(onClick).toHaveBeenCalledOnce();
	});

	it("ограничивает toast-стек шестью элементами и сохраняет полную историю", () => {
		const store = createNotificationsStore();

		for (let index = 0; index < 7; index += 1) {
			store.getState().actions.push({ id: `id-${index}`, type: "info", message: `Сообщение ${index}`, ttlMs: 0 });
		}

		expect(store.getState().items.map((item) => item.id)).toEqual(["id-6", "id-5", "id-4", "id-3", "id-2", "id-1"]);
		expect(store.getState().history.map((item) => item.id)).toEqual(["id-6", "id-5", "id-4", "id-3", "id-2", "id-1", "id-0"]);
	});

	it("обновляет существующее уведомление и не меняет id/createdAt", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-07-03T00:00:00.000Z"));

		const store = createNotificationsStore();
		const id = store.getState().actions.push({ id: "fixed", type: "info", message: "Старт", ttlMs: 0 });
		const createdAt = store.getState().items[0]?.createdAt;

		expect(store.getState().actions.update(id, { type: "success", message: "Готово", ttlMs: 1000 })).toBe(true);
		expect(store.getState().items[0]).toMatchObject({
			id: "fixed",
			createdAt,
			type: "success",
			message: "Готово"
		});
		expect(store.getState().history[0]).toMatchObject({
			id: "fixed",
			createdAt,
			type: "success",
			message: "Готово"
		});

		vi.advanceTimersByTime(1000);

		expect(store.getState().items).toEqual([]);
		expect(store.getState().history).toHaveLength(1);
		expect(store.getState().actions.update("missing", { message: "Нет" })).toBe(false);
	});

	it("upsert обновляет существующее уведомление или создает новое", () => {
		const store = createNotificationsStore();

		expect(store.getState().actions.upsert({ id: "op", type: "info", message: "Старт", ttlMs: 0 })).toBe("op");
		expect(store.getState().actions.upsert({ id: "op", type: "success", message: "Готово", ttlMs: 0 })).toBe("op");
		expect(store.getState().items).toHaveLength(1);
		expect(store.getState().items[0]).toMatchObject({ id: "op", type: "success", message: "Готово" });
		expect(store.getState().history).toHaveLength(1);
		expect(store.getState().history[0]).toMatchObject({ id: "op", type: "success", message: "Готово" });
	});

	it("dismiss и clear скрывают toast-уведомления, но сохраняют историю", () => {
		vi.useFakeTimers();
		const store = createNotificationsStore();

		store.getState().actions.push({ id: "manual", type: "warning", message: "Закрыто вручную", ttlMs: 0 });
		store.getState().actions.dismiss("manual");
		expect(store.getState().items).toEqual([]);
		expect(store.getState().history.map((item) => item.id)).toEqual(["manual"]);

		store.getState().actions.push({ id: "ttl", type: "info", message: "Закрыто общим clear", ttlMs: 1000 });
		store.getState().actions.clear();
		vi.advanceTimersByTime(1000);

		expect(store.getState().items).toEqual([]);
		expect(store.getState().history.map((item) => item.id)).toEqual(["ttl", "manual"]);
	});

	it("clearHistory очищает историю независимо от активного toast-стека", () => {
		const store = createNotificationsStore();

		store.getState().actions.push({ id: "visible", type: "info", message: "Активное уведомление", ttlMs: 0 });
		store.getState().actions.clearHistory();

		expect(store.getState().history).toEqual([]);
		expect(store.getState().items.map((item) => item.id)).toEqual(["visible"]);
	});

	it("не меняет форму уведомления без новой политики и сохраняет явный opt-in", () => {
		const store = createNotificationsStore();
		store.getState().actions.push({ id: "default", type: "info", message: "Прежний контракт", ttlMs: 0 });
		store.getState().actions.update("default", { message: "Обновлённый прежний контракт" });
		store.getState().actions.upsert({ id: "default", type: "success", message: "Готово", ttlMs: 0 });

		expect(store.getState().items[0]).not.toHaveProperty("retainInHistory");
		expect(store.getState().history[0]).toBe(store.getState().items[0]);

		store.getState().actions.push({ id: "explicit", type: "info", message: "Сохранить", ttlMs: 0, retainInHistory: true });
		expect(store.getState().history.map((item) => item.id)).toEqual(["explicit", "default"]);
		expect(store.getState().history[0]).toMatchObject({ retainInHistory: true });
	});

	it("оставляет эфемерный текст только в toast и не меняет чужую историю даже по ссылке", () => {
		const store = createNotificationsStore();
		store.getState().actions.push({ id: "retained", type: "success", message: "Сохранённое уведомление", ttlMs: 0 });
		const history = store.getState().history;

		store.getState().actions.push({ id: "ephemeral", type: "info", message: "Эфемерный текст", ttlMs: 0, retainInHistory: false });

		expect(store.getState().items[0]).toMatchObject({ id: "ephemeral", message: "Эфемерный текст", retainInHistory: false });
		expect(store.getState().history).toBe(history);
		expect(store.getState().history.map((item) => item.id)).toEqual(["retained"]);
	});

	it("push с отказом от истории удаляет прежнюю запись того же ID, не затрагивая соседнюю", () => {
		const store = createNotificationsStore();
		store.getState().actions.push({ id: "same", type: "info", message: "Прежний текст", ttlMs: 0 });
		store.getState().actions.push({ id: "other", type: "success", message: "Чужой текст", ttlMs: 0 });
		const other = store.getState().history[0];

		store.getState().actions.push({ id: "same", type: "info", message: "Новый эфемерный текст", ttlMs: 0, retainInHistory: false });

		expect(store.getState().items.map((item) => item.id)).toEqual(["same", "other"]);
		expect(store.getState().history).toEqual([other]);
		expect(store.getState().history[0]).toBe(other);
	});

	it.each([{}, { retainInHistory: undefined }])("update без определённой политики сохраняет отказ от истории: %j", (patch) => {
		const store = createNotificationsStore();
		store.getState().actions.push({ id: "ephemeral", type: "info", message: "Начало", ttlMs: 0, retainInHistory: false });
		const history = store.getState().history;

		expect(store.getState().actions.update("ephemeral", { message: "После обновления", ...patch })).toBe(true);

		expect(store.getState().items[0]).toMatchObject({ message: "После обновления", retainInHistory: false });
		expect(store.getState().history).toBe(history);
		expect(store.getState().history).toEqual([]);
	});

	it.each([{}, { retainInHistory: undefined }])("upsert без определённой политики сохраняет отказ от истории: %j", (patch) => {
		const store = createNotificationsStore();
		const action = { label: "Действие", onClick: vi.fn() };
		store
			.getState()
			.actions.push({ id: "ephemeral", type: "info", message: "Начало", ttlMs: 0, retainInHistory: false, actions: [action] });
		const history = store.getState().history;

		store.getState().actions.upsert({ id: "ephemeral", type: "success", message: "После upsert", ttlMs: 0, actions: [], ...patch });

		expect(store.getState().items[0]).toMatchObject({ message: "После upsert", retainInHistory: false, actions: [action] });
		expect(store.getState().history).toBe(history);
		expect(store.getState().history).toEqual([]);
	});

	it("после clearHistory update и upsert не возвращают текст без явного opt-in", () => {
		const store = createNotificationsStore();
		store.getState().actions.push({ id: "default", type: "info", message: "Обычное уведомление", ttlMs: 0 });
		store
			.getState()
			.actions.push({ id: "explicit", type: "info", message: "Явно сохраняемое уведомление", ttlMs: 0, retainInHistory: true });
		store.getState().actions.clearHistory();
		const history = store.getState().history;

		store.getState().actions.update("default", { message: "Обновлённый текст", retainInHistory: undefined });
		store.getState().actions.upsert({ id: "explicit", type: "success", message: "Готово", ttlMs: 0 });

		expect(store.getState().items.map((item) => item.id)).toEqual(["explicit", "default"]);
		expect(store.getState().history).toBe(history);
		expect(store.getState().history).toEqual([]);
	});

	it.each(["update", "upsert"] as const)("явный отказ через %s удаляет только соответствующий текст из истории", (operation) => {
		const store = createNotificationsStore();
		store.getState().actions.push({ id: "other", type: "success", message: "Соседнее уведомление", ttlMs: 0 });
		store.getState().actions.push({ id: "same", type: "info", message: "До отказа", ttlMs: 0 });
		const other = store.getState().history[1];

		if (operation === "update") {
			store.getState().actions.update("same", { message: "После отказа", retainInHistory: false });
		} else {
			store.getState().actions.upsert({ id: "same", type: "info", message: "После отказа", ttlMs: 0, retainInHistory: false });
		}

		expect(store.getState().items[0]).toMatchObject({ id: "same", message: "После отказа", retainInHistory: false });
		expect(store.getState().history).toEqual([other]);
		expect(store.getState().history[0]).toBe(other);
	});

	it.each(["update", "upsert"] as const)("явный opt-in через %s возвращает активный toast без смены ID и createdAt", (operation) => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-10-06T00:00:00.000Z"));
		const store = createNotificationsStore();
		store.getState().actions.push({ id: "other", type: "success", message: "Соседнее уведомление", ttlMs: 0 });
		store.getState().actions.push({ id: "same", type: "info", message: "Эфемерное уведомление", ttlMs: 0, retainInHistory: false });
		const createdAt = store.getState().items[0]?.createdAt;
		vi.advanceTimersByTime(1000);

		if (operation === "update") {
			store.getState().actions.update("same", { message: "Сохраняемый текст", retainInHistory: true });
		} else {
			store.getState().actions.upsert({ id: "same", type: "success", message: "Сохраняемый текст", ttlMs: 0, retainInHistory: true });
		}

		expect(store.getState().history.map((item) => item.id)).toEqual(["same", "other"]);
		expect(store.getState().history[0]).toMatchObject({ id: "same", createdAt, message: "Сохраняемый текст", retainInHistory: true });
		expect(store.getState().history[0]).toBe(store.getState().items[0]);
	});

	it("явный opt-in после clearHistory возвращает запись, не дублируя её при следующих обновлениях", () => {
		const store = createNotificationsStore();
		store.getState().actions.push({ id: "same", type: "info", message: "Начало", ttlMs: 0 });
		store.getState().actions.clearHistory();
		store.getState().actions.update("same", { retainInHistory: true });
		store.getState().actions.push({ id: "other", type: "success", message: "Следующее уведомление", ttlMs: 0 });
		store.getState().actions.upsert({ id: "same", type: "success", message: "Готово", ttlMs: 0, retainInHistory: true });

		expect(store.getState().history.map((item) => item.id)).toEqual(["other", "same"]);
		expect(store.getState().history[1]).toMatchObject({ message: "Готово", retainInHistory: true });
	});

	it("TTL, dismiss и clear не превращают эфемерные toast в записи истории", () => {
		vi.useFakeTimers();
		const store = createNotificationsStore();
		store.getState().actions.push({ id: "retained", type: "success", message: "Соседнее уведомление", ttlMs: 0 });
		store.getState().actions.push({ id: "ttl", type: "info", message: "Временный текст", ttlMs: 1000, retainInHistory: false });
		store.getState().actions.update("ttl", { ttlMs: 2000 });
		vi.advanceTimersByTime(1000);
		expect(store.getState().items.map((item) => item.id)).toEqual(["ttl", "retained"]);
		vi.advanceTimersByTime(1000);
		expect(store.getState().items.map((item) => item.id)).toEqual(["retained"]);

		store.getState().actions.push({ id: "manual", type: "info", message: "Скрываемый текст", ttlMs: 0, retainInHistory: false });
		store.getState().actions.dismiss("manual");
		store.getState().actions.push({ id: "clear", type: "info", message: "Очищаемый текст", ttlMs: 1000, retainInHistory: false });
		store.getState().actions.clear();
		vi.advanceTimersByTime(1000);

		expect(store.getState().items).toEqual([]);
		expect(store.getState().history.map((item) => item.id)).toEqual(["retained"]);
	});

	it("переполнение стека не сохраняет вытесненный эфемерный текст", () => {
		const store = createNotificationsStore();
		store.getState().actions.push({ id: "retained", type: "success", message: "Сохраняемое уведомление", ttlMs: 0 });

		for (let index = 0; index < 7; index += 1) {
			store.getState().actions.push({
				id: `ephemeral-${index}`,
				type: "info",
				message: `Эфемерный текст ${index}`,
				ttlMs: 0,
				retainInHistory: false
			});
		}

		expect(store.getState().items.map((item) => item.id)).toEqual([
			"ephemeral-6",
			"ephemeral-5",
			"ephemeral-4",
			"ephemeral-3",
			"ephemeral-2",
			"ephemeral-1"
		]);
		expect(store.getState().history.map((item) => item.id)).toEqual(["retained"]);
	});

	it("отсутствующий toast не получает бессрочный реестр политики по ID", () => {
		const store = createNotificationsStore();
		store.getState().actions.push({ id: "same", type: "info", message: "Эфемерный текст", ttlMs: 0, retainInHistory: false });
		store.getState().actions.dismiss("same");

		expect(store.getState().actions.update("same", { retainInHistory: true })).toBe(false);
		expect(store.getState().history).toEqual([]);

		store.getState().actions.upsert({ id: "same", type: "success", message: "Новое уведомление", ttlMs: 0 });
		expect(store.getState().history[0]).toMatchObject({ id: "same", message: "Новое уведомление" });
		expect(store.getState().items[0]).not.toHaveProperty("retainInHistory");
	});
});

describe("notify facade", () => {
	it("требует привязанный store", () => {
		expect(() => notify.info("Без store")).toThrow("Notifications store is not bound");
	});

	it("проксирует быстрые методы и отвязывается через cleanup", () => {
		const store = createNotificationsStore();
		const unbind = bindNotifications(store);

		const id = notify.success("Готово", { id: "success", ttlMs: 0 });

		expect(id).toBe("success");
		expect(store.getState().items[0]).toMatchObject({ id: "success", type: "success", message: "Готово" });

		notify.warning("Проверьте", { id: "warning", ttlMs: 0 });
		expect(store.getState().items[0]).toMatchObject({ id: "warning", type: "warning" });

		notify.clearHistory();
		expect(store.getState().history).toEqual([]);
		expect(store.getState().items).toHaveLength(2);

		unbind();
		expect(() => notify.clear()).toThrow("Notifications store is not bound");
	});

	it("ведёт progress-уведомление через update/success/error/dismiss", () => {
		const store = createNotificationsStore();
		const unbind = bindNotifications(store);

		const progress = notify.progress("Сохраняю", { id: "operation", title: "Операция" });
		progress.update("Почти готово");
		expect(store.getState().items[0]).toMatchObject({
			id: "operation",
			title: "Операция",
			type: "info",
			message: "Почти готово",
			dismissible: false
		});

		progress.success("Готово");
		expect(store.getState().items[0]).toMatchObject({
			type: "success",
			message: "Готово",
			dismissible: true,
			ttlMs: 2500
		});

		progress.error("Ошибка", 1000);
		expect(store.getState().items[0]).toMatchObject({
			type: "error",
			message: "Ошибка",
			ttlMs: 1000
		});

		progress.dismiss();
		expect(store.getState().items).toEqual([]);

		unbind();
	});

	it.each(["success", "info", "warning", "error"] as const)("сокращённый метод %s передаёт opt-out в store", (type) => {
		const store = createNotificationsStore();
		const unbind = bindNotifications(store);

		try {
			notify[type]("Эфемерный текст", { id: "ephemeral", ttlMs: 0, retainInHistory: false });
			expect(store.getState().items[0]).toMatchObject({ id: "ephemeral", type, retainInHistory: false });
			expect(store.getState().history).toEqual([]);
		} finally {
			unbind();
		}
	});

	it("фасад push/update/upsert сохраняет политику и допускает только явный возврат в историю", () => {
		const store = createNotificationsStore();
		const unbind = bindNotifications(store);

		try {
			notify.push({ id: "ephemeral", type: "info", message: "Начало", ttlMs: 0, retainInHistory: false });
			notify.update("ephemeral", { message: "Обновление", retainInHistory: undefined });
			notify.upsert({ id: "ephemeral", type: "success", message: "Готово", ttlMs: 0 });
			expect(store.getState().history).toEqual([]);

			notify.update("ephemeral", { retainInHistory: true });
			expect(store.getState().history[0]).toMatchObject({ id: "ephemeral", message: "Готово", retainInHistory: true });
			notify.clearHistory();
			notify.upsert({ id: "ephemeral", type: "success", message: "Повторное обновление", ttlMs: 0 });
			expect(store.getState().history).toEqual([]);
		} finally {
			unbind();
		}
	});
});

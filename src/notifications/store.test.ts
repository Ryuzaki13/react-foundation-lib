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

	it("добавляет новые уведомления в начало и ограничивает список шестью элементами", () => {
		const store = createNotificationsStore();

		for (let index = 0; index < 7; index += 1) {
			store.getState().actions.push({ id: `id-${index}`, type: "info", message: `Сообщение ${index}`, ttlMs: 0 });
		}

		expect(store.getState().items.map((item) => item.id)).toEqual(["id-6", "id-5", "id-4", "id-3", "id-2", "id-1"]);
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

		vi.advanceTimersByTime(1000);

		expect(store.getState().items).toEqual([]);
		expect(store.getState().actions.update("missing", { message: "Нет" })).toBe(false);
	});

	it("upsert обновляет существующее уведомление или создает новое", () => {
		const store = createNotificationsStore();

		expect(store.getState().actions.upsert({ id: "op", type: "info", message: "Старт", ttlMs: 0 })).toBe("op");
		expect(store.getState().actions.upsert({ id: "op", type: "success", message: "Готово", ttlMs: 0 })).toBe("op");
		expect(store.getState().items).toHaveLength(1);
		expect(store.getState().items[0]).toMatchObject({ id: "op", type: "success", message: "Готово" });
	});

	it("clear удаляет уведомления и отменяет таймеры", () => {
		vi.useFakeTimers();
		const store = createNotificationsStore();

		store.getState().actions.push({ id: "ttl", type: "info", message: "Будет удалено", ttlMs: 1000 });
		store.getState().actions.clear();
		vi.advanceTimersByTime(1000);

		expect(store.getState().items).toEqual([]);
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
});

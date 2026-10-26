import { describe, expect, it, vi } from "vitest";

import { createDeferredPromise } from "./index";

describe("createDeferredPromise", () => {
	it("ожидает внешнее завершение и передаёт значение подписчику", async () => {
		const completion = createDeferredPromise<string>();
		const onResolved = vi.fn();
		const observation = completion.promise.then(onResolved);

		await Promise.resolve();
		expect(onResolved).not.toHaveBeenCalled();
		completion.resolve("Готово");
		await observation;

		expect(onResolved).toHaveBeenCalledExactlyOnceWith("Готово");
	});

	it("передаёт исходную причину отказа", async () => {
		const completion = createDeferredPromise<void>();
		const reason = new Error("Операция отменена.");
		completion.reject(reason);

		await expect(completion.promise).rejects.toBe(reason);
	});

	it("принимает PromiseLike и ожидает его результат", async () => {
		const source = createDeferredPromise<number>();
		const completion = createDeferredPromise<number>();
		const thenable: PromiseLike<number> = {
			then: (onfulfilled, onrejected) => source.promise.then(onfulfilled, onrejected)
		};
		completion.resolve(thenable);
		source.resolve(42);

		await expect(completion.promise).resolves.toBe(42);
	});

	it("сохраняет решение ожидать переданный Promise, включая его отказ", async () => {
		const source = createDeferredPromise<number>();
		const completion = createDeferredPromise<number>();
		const reason = new Error("Отказ переданного Promise.");
		completion.resolve(source.promise);
		completion.reject(new Error("Поздний отказ внешней операции."));
		source.reject(reason);

		await expect(completion.promise).rejects.toBe(reason);
	});

	it("сохраняет первое успешное завершение", async () => {
		const completion = createDeferredPromise<number>();
		completion.resolve(1);
		completion.resolve(2);
		completion.reject(new Error("Поздний отказ."));

		await expect(completion.promise).resolves.toBe(1);
	});

	it("сохраняет первый отказ", async () => {
		const completion = createDeferredPromise<number>();
		const reason = new Error("Первый отказ.");
		completion.reject(reason);
		completion.resolve(42);
		completion.reject(new Error("Поздний отказ."));

		await expect(completion.promise).rejects.toBe(reason);
	});

	it("разделяет независимые ожидания и завершает Promise<void> без значения", async () => {
		const first = createDeferredPromise<void>();
		const second = createDeferredPromise<void>();
		const onSecondResolved = vi.fn();
		const observation = second.promise.then(onSecondResolved);
		first.resolve();
		await first.promise;
		expect(onSecondResolved).not.toHaveBeenCalled();

		second.resolve();
		await observation;
		expect(onSecondResolved).toHaveBeenCalledOnce();
	});

	it("работает без дополнительного метода завершения на глобальном Promise", async () => {
		const originalDescriptor = Object.getOwnPropertyDescriptor(Promise, "withResolvers");
		Reflect.deleteProperty(Promise, "withResolvers");
		try {
			const completion = createDeferredPromise<string>();
			completion.resolve("Совместимо с ES2022");

			await expect(completion.promise).resolves.toBe("Совместимо с ES2022");
			expect(Reflect.has(Promise, "withResolvers")).toBe(false);
		} finally {
			if (originalDescriptor) Object.defineProperty(Promise, "withResolvers", originalDescriptor);
		}
	});
});

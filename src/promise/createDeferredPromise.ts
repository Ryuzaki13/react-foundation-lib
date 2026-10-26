import { type DeferredPromise } from "./deferredPromiseTypes";

/**
 * Создаёт управляемое ожидание через обычный Promise без дополнительных runtime API.
 * Подходит для завершения операции из callback; не устанавливает полифиллы и
 * сохраняет нативные правила разрешения thenable и первого завершения.
 */
export function createDeferredPromise<T>(): DeferredPromise<T> {
	let resolve: DeferredPromise<T>["resolve"] | undefined;
	let reject: DeferredPromise<T>["reject"] | undefined;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});

	// Promise вызывает executor синхронно. Проверка фиксирует этот invariant для
	// TypeScript, который не отслеживает присваивания внутри callback конструктора.
	if (resolve === undefined || reject === undefined) {
		throw new Error("Конструктор Promise не предоставил функции завершения синхронно.");
	}
	return { promise, resolve, reject };
}

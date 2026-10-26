/** Promise, завершением которого владелец управляет из внешнего события или lifecycle. */
export type DeferredPromise<T> = {
	readonly promise: Promise<T>;
	readonly resolve: (value: T | PromiseLike<T>) => void;
	readonly reject: (reason?: unknown) => void;
};

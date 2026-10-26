import { createDeferredPromise, type DeferredPromise } from "../src/promise";

const create: <T>() => DeferredPromise<T> = createDeferredPromise;
const completion = create<number>();
const promise: Promise<number> = completion.promise;
const resolve: (value: number | PromiseLike<number>) => void = completion.resolve;
const reject: (reason?: unknown) => void = completion.reject;
resolve(1);
resolve(Promise.resolve(2));
reject(new Error("Отказ операции."));
reject();

const empty = create<void>();
empty.resolve();

// @ts-expect-error Управляемое ожидание сохраняет тип результата.
completion.resolve("не число");
// @ts-expect-error Владелец не может заменить публичный Promise.
completion.promise = Promise.resolve(1);

void [promise, resolve, reject];

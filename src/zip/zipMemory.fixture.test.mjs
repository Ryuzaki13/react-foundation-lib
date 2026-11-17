import { createJiti } from "jiti";

// Загружаем текущие исходники: проверка не зависит от наличия или свежести dist.
const jiti = createJiti(import.meta.url);
const { createZipBlob } = await jiti.import("./index.ts");
const { createDeferredPromise } = await jiti.import("../promise/index.ts");

function startArchive(withProcessedFile) {
	const started = createDeferredPromise();
	const reading = createDeferredPromise();
	const part = new Blob(["ожидающая часть"]);
	part.arrayBuffer = () => {
		started.resolve();
		return reading.promise;
	};

	const waiting = new Blob(["ожидающий файл"]);
	waiting.slice = () => part;
	const next = new Blob([new Uint8Array(1024 * 1024)]);
	const processed = withProcessedFile ? new Blob(["готовый файл"]) : undefined;
	const blobs = processed ? [processed, waiting, next] : [waiting, next];
	const controller = new AbortController();
	const result = createZipBlob(
		blobs.map((blob, index) => ({ blob, filename: `${index}.txt` })),
		{ signal: controller.signal }
	);

	return {
		started,
		reading,
		controller,
		result,
		processed: processed && new WeakRef(processed),
		pending: [new WeakRef(waiting), new WeakRef(next)]
	};
}

async function collectGarbage() {
	// WeakRef сохраняет объект до конца текущего job. Между GC нужны новые
	// event-loop turns; проверять deref внутри цикла нельзя: это продлит жизнь.
	for (let index = 0; index < 10; index++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
		globalThis.gc();
	}
}

const archive = startArchive(process.argv[2] === "processed");
await archive.started.promise;
await collectGarbage();
const processedRetained = Boolean(archive.processed?.deref());

archive.controller.abort();
await archive.result.catch(() => undefined);
await collectGarbage();
const retainedAfterAbort = archive.pending.map((reference) => Boolean(reference.deref()));

// Позднее завершение чтения позволяет штатно завершиться внутреннему async frame.
archive.reading.resolve(new ArrayBuffer(0));
process.stdout.write(JSON.stringify({ processedRetained, retainedAfterAbort }));

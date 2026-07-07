import { assertNotAborted } from "./assert";
import { FileMeta, ReadFileError, ReadFileOptions, ReadFileResult, ReadMode } from "./types";

function normalizeMime(mime?: string): string {
	return mime?.trim().toLowerCase() ?? "";
}

function getFileExtension(fileName: string): string {
	const extension = fileName.split(".").pop();
	return normalizeMime(extension);
}

export function buildMeta(file: File): FileMeta {
	return {
		mime: file.type,
		size: file.size,
		name: file.name,
		lastModified: file.lastModified
	};
}

export function attachAbort(signal: AbortSignal | undefined, reader: FileReader): (() => void) | undefined {
	if (!signal) return undefined;

	const onAbort = () => {
		try {
			reader.abort();
		} catch {
			// ignore
		}
	};

	signal.addEventListener("abort", onAbort, { once: true });
	return () => signal.removeEventListener("abort", onAbort);
}

function validateFile(file: File, opts: ReadFileOptions): void {
	if (opts.allowedMime && opts.allowedMime.length > 0) {
		const allowed = new Set(opts.allowedMime.map((mime) => normalizeMime(mime)));
		const fileMime = normalizeMime(file.type);
		if (!allowed.has(fileMime)) {
			throw new ReadFileError("MIME_NOT_ALLOWED", `Неподдерживаемый MIME тип: ${file.type}`);
		}
	} else if (opts.accept && opts.accept.length > 0) {
		// Берём расширение файла, если его нет, пытаемся вытащить из MIME
		const fileMime = getFileExtension(file.name) || file.type.split("/").pop();
		if (!fileMime) {
			// NOTE: Если неизвестный mime и нет расширения? Пока запретить такой сценарий
			throw new ReadFileError("MIME_NOT_ALLOWED", `Неопределенный MIME тип`);
		}

		const allowed = opts.accept.map((mime) => normalizeMime(mime));
		const isAllowed = allowed.some((mime) => mime.includes(fileMime));

		if (!isAllowed) {
			throw new ReadFileError("MIME_NOT_ALLOWED", `Неподдерживаемый MIME тип: ${fileMime}`);
		}
	}

	if (typeof opts.maxBytes === "number" && file.size > opts.maxBytes) {
		throw new ReadFileError("FILE_TOO_LARGE", `Файл слишком большой: ${file.size} > ${opts.maxBytes}`);
	}
}

function readAsDataUrl(file: File, opts: ReadFileOptions): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		const detachAbort = attachAbort(opts.signal, reader);

		reader.onerror = () => {
			detachAbort?.();
			reject(new ReadFileError("READ_FAILED", "Не удалось прочитать файл как DataURL", reader.error));
		};

		reader.onabort = () => {
			detachAbort?.();
			reject(new ReadFileError("READ_ABORTED", "Чтение файла прервано"));
		};

		reader.onload = () => {
			detachAbort?.();
			const result = reader.result;
			if (typeof result !== "string") {
				reject(new ReadFileError("READ_FAILED", "Неожиданный тип результата FileReader"));
				return;
			}
			resolve(result);
		};

		try {
			reader.readAsDataURL(file);
		} catch (cause) {
			detachAbort?.();
			reject(new ReadFileError("READ_FAILED", "При чтении DataURL функция FileReader выдала ошибку", cause));
		}
	});
}

function readAsArrayBuffer(file: File, opts: ReadFileOptions): Promise<ArrayBuffer> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		const detachAbort = attachAbort(opts.signal, reader);

		reader.onerror = () => {
			detachAbort?.();
			reject(new ReadFileError("READ_FAILED", "Не удалось прочитать файл как ArrayBuffer.", reader.error));
		};

		reader.onabort = () => {
			detachAbort?.();
			reject(new ReadFileError("READ_ABORTED", "Чтение файла прервано"));
		};

		reader.onload = () => {
			detachAbort?.();
			const result = reader.result;
			if (!(result instanceof ArrayBuffer)) {
				reject(new ReadFileError("READ_FAILED", "Неожиданный тип результата FileReader"));
				return;
			}
			resolve(result);
		};

		try {
			reader.readAsArrayBuffer(file);
		} catch (cause) {
			detachAbort?.();
			reject(new ReadFileError("READ_FAILED", "При чтении ArrayBuffer возникла ошибка FileReader", cause));
		}
	});
}

// Перегрузки для строгой типизации результата

export async function readFile(
	file: File,
	opts?: Omit<ReadFileOptions, "mode"> & { mode?: "data-url" }
): Promise<Extract<ReadFileResult, { mode: "data-url" }>>;
export async function readFile(
	file: File,
	opts: Omit<ReadFileOptions, "mode"> & { mode: "array-buffer" }
): Promise<Extract<ReadFileResult, { mode: "array-buffer" }>>;

export async function readFile(file: File, opts: ReadFileOptions = {}): Promise<ReadFileResult> {
	assertNotAborted(opts.signal);
	validateFile(file, opts);

	const mode: ReadMode = opts.mode ?? "data-url";
	const meta = buildMeta(file);

	if (mode === "array-buffer") {
		const buffer = await readAsArrayBuffer(file, opts);
		return { mode: "array-buffer", meta, buffer, file };
	}

	const dataUrl = await readAsDataUrl(file, opts);
	return { mode: "data-url", meta, dataUrl, file };
}

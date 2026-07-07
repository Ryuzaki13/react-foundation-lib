export type ReadMode = "data-url" | "array-buffer";

export type ReadFileErrorCode = "NO_FILE" | "MIME_NOT_ALLOWED" | "FILE_TOO_LARGE" | "READ_ABORTED" | "READ_FAILED";

export class ReadFileError extends Error {
	public readonly code: ReadFileErrorCode;
	public readonly cause?: unknown;

	constructor(code: ReadFileErrorCode, message?: string, cause?: unknown) {
		super(message ?? code);
		this.name = "ReadFileError";
		this.code = code;
		this.cause = cause;
	}
}

export type FileMeta = {
	mime: string;
	size: number;
	name: string;
	lastModified: number;
};

export type ReadFileOptionsBase = {
	accept?: readonly string[];
	/** Ограничение по MIME (если не указано — любые файлы) */
	allowedMime?: readonly string[];
	/** Ограничение по размеру файла (байты) */
	maxBytes?: number;
	/** AbortController для отмены */
	signal?: AbortSignal;
};

export type ReadFileAsDataUrlOptions = ReadFileOptionsBase & {
	mode?: "data-url";
};

export type ReadFileAsArrayBufferOptions = ReadFileOptionsBase & {
	mode: "array-buffer";
};

export type ReadFileOptions = ReadFileAsDataUrlOptions | ReadFileAsArrayBufferOptions;

export type ReadFileAsDataUrlResult = {
	mode: "data-url";
	meta: FileMeta;
	dataUrl: string;
	file: File;
};

export type ReadFileAsArrayBufferResult = {
	mode: "array-buffer";
	meta: FileMeta;
	buffer: ArrayBuffer;
	file: File;
};

export type ReadFileResult = ReadFileAsDataUrlResult | ReadFileAsArrayBufferResult;

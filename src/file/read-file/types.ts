import {
	type READ_FILE_ERROR_FILE_TOO_LARGE,
	type READ_FILE_ERROR_MIME_NOT_ALLOWED,
	type READ_FILE_ERROR_NO_FILE,
	type READ_FILE_ERROR_READ_ABORTED,
	type READ_FILE_ERROR_READ_FAILED,
	type READ_FILE_MODE_ARRAY_BUFFER,
	type READ_FILE_MODE_DATA_URL
} from "./readFileConstants";

export type ReadMode = typeof READ_FILE_MODE_DATA_URL | typeof READ_FILE_MODE_ARRAY_BUFFER;

export type ReadFileErrorCode =
	| typeof READ_FILE_ERROR_NO_FILE
	| typeof READ_FILE_ERROR_MIME_NOT_ALLOWED
	| typeof READ_FILE_ERROR_FILE_TOO_LARGE
	| typeof READ_FILE_ERROR_READ_ABORTED
	| typeof READ_FILE_ERROR_READ_FAILED;

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
	mode?: typeof READ_FILE_MODE_DATA_URL;
};

export type ReadFileAsArrayBufferOptions = ReadFileOptionsBase & {
	mode: typeof READ_FILE_MODE_ARRAY_BUFFER;
};

export type ReadFileOptions = ReadFileAsDataUrlOptions | ReadFileAsArrayBufferOptions;

export type ReadFileAsDataUrlResult = {
	mode: typeof READ_FILE_MODE_DATA_URL;
	meta: FileMeta;
	dataUrl: string;
	file: File;
};

export type ReadFileAsArrayBufferResult = {
	mode: typeof READ_FILE_MODE_ARRAY_BUFFER;
	meta: FileMeta;
	buffer: ArrayBuffer;
	file: File;
};

export type ReadFileResult = ReadFileAsDataUrlResult | ReadFileAsArrayBufferResult;

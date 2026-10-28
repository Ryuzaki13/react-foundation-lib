import { type READ_FILE_MODE_ARRAY_BUFFER, type READ_FILE_MODE_DATA_URL } from "../read-file/readFileConstants";

import { type READ_IMAGE_ERROR_NOT_AN_IMAGE } from "./imageReadConstants";

import type { ReadFileAsArrayBufferResult, ReadFileAsDataUrlResult, ReadFileErrorCode, ReadFileOptionsBase } from "../read-file";

export type ImageMime = "image/png" | "image/jpeg" | "image/webp" | "image/gif" | "image/svg+xml" | "image/avif";

export type ReadImageErrorCode = ReadFileErrorCode | typeof READ_IMAGE_ERROR_NOT_AN_IMAGE | "IMAGE_DECODE_FAILED";

export class ReadImageError extends Error {
	public readonly code: ReadImageErrorCode;
	public readonly cause?: unknown;

	constructor(code: ReadImageErrorCode, message?: string, cause?: unknown) {
		super(message ?? code);
		this.name = "ReadImageError";
		this.code = code;
		this.cause = cause;
	}
}

export type ReadImageOptionsBase = Omit<ReadFileOptionsBase, "allowedMime"> & {
	/** Ограничение по MIME (если не указано — любые image/*) */
	allowedMime?: readonly ImageMime[];
};

export type ReadImageAsDataUrlOptions = ReadImageOptionsBase & {
	mode?: typeof READ_FILE_MODE_DATA_URL;
};

export type ReadImageAsArrayBufferOptions = ReadImageOptionsBase & {
	mode: typeof READ_FILE_MODE_ARRAY_BUFFER;
};

export type ReadImageOptions = ReadImageAsDataUrlOptions | ReadImageAsArrayBufferOptions;

export type ImageDimensions = {
	width: number;
	height: number;
};

export type ReadImageAsDataUrlResult = ReadFileAsDataUrlResult & {
	/** безопасно вытащенные размеры (через decode) */
	dimensions?: ImageDimensions;
};

export type ReadImageAsArrayBufferResult = ReadFileAsArrayBufferResult;

export type ReadImageResult = ReadImageAsDataUrlResult | ReadImageAsArrayBufferResult;

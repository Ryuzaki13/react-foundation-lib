import { assertNotAborted, readFile } from "../read-file";
import { READ_FILE_MODE_ARRAY_BUFFER, type READ_FILE_MODE_DATA_URL } from "../read-file/readFileConstants";

import { READ_IMAGE_ERROR_NOT_AN_IMAGE } from "./imageReadConstants";
import { ReadImageError } from "./types";

import type { ImageDimensions, ReadImageAsArrayBufferResult, ReadImageAsDataUrlResult, ReadImageOptions } from "./types";

function isImageMime(mime: string): boolean {
	return mime.startsWith("image/");
}

async function decodeImageDimensions(dataUrl: string, signal?: AbortSignal): Promise<ImageDimensions> {
	assertNotAborted(signal);

	const img = new Image();
	img.decoding = "async";
	img.src = dataUrl;

	// decode() поддерживается в современных браузерах; fallback на onload
	// NOTE: большого размера png падают...
	// if (typeof img.decode === "function") {
	// 	try {
	// 		await img.decode();
	// 		assertNotAborted(signal);
	// 		return { width: img.naturalWidth, height: img.naturalHeight };
	// 	} catch (cause) {
	// 		throw new ReadImageError("IMAGE_DECODE_FAILED", "Не удалось декодировать изображение", cause);
	// 	}
	// }

	await new Promise<void>((resolve, reject) => {
		const cleanup = () => {
			img.onload = null;
			img.onerror = null;
		};

		img.onload = () => {
			cleanup();
			resolve();
		};
		img.onerror = (ev) => {
			cleanup();
			reject(ev);
		};
	});

	assertNotAborted(signal);
	return { width: img.naturalWidth, height: img.naturalHeight };
}

//  Перегрузки для строгой типизации результата

export async function readImageFile(
	file: File,
	opts?: Omit<ReadImageOptions, "mode"> & { mode?: typeof READ_FILE_MODE_DATA_URL }
): Promise<ReadImageAsDataUrlResult>;
export async function readImageFile(
	file: File,
	opts: Omit<ReadImageOptions, "mode"> & { mode: typeof READ_FILE_MODE_ARRAY_BUFFER }
): Promise<ReadImageAsArrayBufferResult>;

export async function readImageFile(
	file: File,
	opts: ReadImageOptions = {}
): Promise<ReadImageAsDataUrlResult | ReadImageAsArrayBufferResult> {
	if (!isImageMime(file.type)) {
		throw new ReadImageError(READ_IMAGE_ERROR_NOT_AN_IMAGE, `Файл не является изображением. mime=${file.type || "unknown"}`);
	}

	const baseOpts = { allowedMime: opts.allowedMime, maxBytes: opts.maxBytes, signal: opts.signal };

	if (opts.mode === READ_FILE_MODE_ARRAY_BUFFER) {
		return readFile(file, { ...baseOpts, mode: READ_FILE_MODE_ARRAY_BUFFER });
	}

	const result = await readFile(file, baseOpts);
	const dimensions = await decodeImageDimensions(result.dataUrl, opts.signal);

	return { ...result, dimensions };
}

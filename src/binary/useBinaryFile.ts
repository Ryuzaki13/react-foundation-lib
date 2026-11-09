import { useEffect, useMemo } from "react";

import { MIME_TYPE_OCTET_STREAM } from "../file/mimeTypeConstants";
import { logError } from "../utils";

import { binaryToBlob, findMimeType } from "./binaryToBlob";

type BinaryFileData = {
	blob: Blob;
	mime: string;
	/** MIME взят из data URL или определён по сигнатуре. Значение false обозначает подстановку нейтрального MIME. */
	isMimeDetected: boolean;
};

export type UseBinaryFileResult = {
	data: BinaryFileData | null;
	error: string | null;
};

/**
 * Декодирует текущий bin при рендере. Мемоизация позволяет просмотрщику
 * переиспользовать Blob при повторном рендере с тем же входом.
 */
export function useBinaryFile(bin: string | undefined): UseBinaryFileResult {
	const { data, failure } = useMemo(() => {
		if (!bin) {
			return { data: null, failure: null };
		}

		try {
			const detectedMime = findMimeType(undefined, bin);
			const mime = detectedMime ?? MIME_TYPE_OCTET_STREAM;
			const blob = binaryToBlob(bin, mime, true);

			return { data: { blob, mime, isMimeDetected: detectedMime !== null }, failure: null };
		} catch (cause) {
			return { data: null, failure: { cause, message: String(cause) } };
		}
	}, [bin]);

	useEffect(() => {
		if (failure) {
			logError(failure.cause);
		}
	}, [failure]);

	return { data, error: failure?.message ?? null };
}

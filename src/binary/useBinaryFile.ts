import { useEffect, useEffectEvent, useState } from "react";

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

export function useBinaryFile(bin: string | undefined): UseBinaryFileResult {
	const [entry, setEntry] = useState<BinaryFileData | null>(null);
	const [error, setError] = useState<string | null>(null);

	const updateEntry = useEffectEvent((data: BinaryFileData | null) => setEntry(data));
	const updateError = useEffectEvent((error: string | null) => setError(error));

	useEffect(() => {
		if (bin) {
			try {
				const detectedMime = findMimeType(undefined, bin);
				const mime = detectedMime ?? MIME_TYPE_OCTET_STREAM;
				const blob = binaryToBlob(bin, mime, true);

				updateEntry({ blob, mime, isMimeDetected: detectedMime !== null });
				updateError(null);
			} catch (e) {
				logError(e);

				updateError(String(e));
				updateEntry(null);
			}
		} else {
			updateEntry(null);
			updateError(null);
		}
	}, [bin]);

	return { data: entry, error };
}

import { useEffect, useEffectEvent, useState } from "react";

import { logError } from "../utils";

import { binaryToBlob, detectMimeType } from "./binaryToBlob";

export function useBinaryFile(bin: string | undefined) {
	const [entry, setEntry] = useState<{ blob: Blob; mime: string } | null>(null);
	const [error, setError] = useState<string | null>(null);

	const updateEntry = useEffectEvent((data: { blob: Blob; mime: string } | null) => setEntry(data));
	const updateError = useEffectEvent((error: string | null) => setError(error));

	useEffect(() => {
		if (bin) {
			try {
				const mime = detectMimeType(undefined, bin);
				const blob = binaryToBlob(bin, mime, true);

				updateEntry({ blob, mime });
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

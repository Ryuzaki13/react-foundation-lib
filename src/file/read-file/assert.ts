import { ReadFileError } from "./types";

const MIME_PART_PATTERN = "[a-z0-9!#$&^_.+-]+";
const STRICT_MIME_PATTERN = new RegExp(`^${MIME_PART_PATTERN}\\/${MIME_PART_PATTERN}$`, "i");
const ACCEPT_MIME_PATTERN = new RegExp(`^${MIME_PART_PATTERN}\\/(?:${MIME_PART_PATTERN}|\\*)$`, "i");
const ACCEPT_EXTENSION_PATTERN = /^\.[^\s,]+$/;

export function assertValidAllowedMime(allowedMime?: readonly string[]): void {
	if (!allowedMime) return;

	for (const [index, mime] of allowedMime.entries()) {
		if (!STRICT_MIME_PATTERN.test(mime)) {
			throw new Error(
				`DropZone: некорректный allowedMime[${index}]="${mime}". Ожидается полный MIME-тип вида "application/pdf" без wildcard и параметров.`
			);
		}
	}
}

export function assertValidAccept(accept?: readonly string[]): void {
	if (!accept) return;

	for (const [index, specifier] of accept.entries()) {
		const isValidSpecifier = ACCEPT_EXTENSION_PATTERN.test(specifier) || ACCEPT_MIME_PATTERN.test(specifier);

		if (!isValidSpecifier) {
			throw new Error(
				`DropZone: некорректный accept[${index}]="${specifier}". Ожидается расширение вида ".pdf" или MIME-тип вида "application/pdf" / "image/*".`
			);
		}
	}
}

export function assertNotAborted(signal?: AbortSignal): void {
	if (signal?.aborted) {
		throw new ReadFileError("READ_ABORTED", "Прервано по сигналу");
	}
}

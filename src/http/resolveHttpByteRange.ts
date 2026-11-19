/** Границы одного HTTP-диапазона включают оба указанных байта. */
export type HttpByteRange = { readonly start: number; readonly end: number };

/**
 * Выбирает один диапазон по фактической длине представления. По RFC 9110 сервер
 * может проигнорировать неизвестную единицу, неверный синтаксис и multipart (null).
 * Корректный одиночный диапазон без доступных байтов требует ответа 416.
 */
export function resolveHttpByteRange(header: string | null, size: number): HttpByteRange | "unsatisfiable" | null {
	if (!Number.isSafeInteger(size) || size < 0) throw new RangeError("Некорректный размер представления.");
	if (header === null) return null;

	const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
	if (!match || (!match[1] && !match[2])) return null;

	if (!match[1]) {
		const length = Number(match[2]);
		return length && size ? { start: Math.max(0, size - length), end: size - 1 } : "unsatisfiable";
	}

	const start = Number(match[1]);
	const requestedEnd = match[2] ? Number(match[2]) : Infinity;
	if (requestedEnd < start) return null;
	if (start >= size) return "unsatisfiable";

	return { start, end: Math.min(requestedEnd, size - 1) };
}

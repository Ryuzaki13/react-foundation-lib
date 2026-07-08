/**
 * Нейтральные идентификаторы редактируемых сегментов даты и времени.
 */
export type DateSegmentId = "year" | "month" | "day" | "hours" | "minutes" | "seconds";

/**
 * Редактируемый сегмент маски даты/времени.
 */
export interface EditableDateSegment {
	kind: "editable";
	id: DateSegmentId;
	token: string;
	length: number;
	min: number;
	max: number;
	placeholder: string;
	ariaLabel: string;
}

/**
 * Литеральный сегмент маски даты/времени.
 */
export interface LiteralDateSegment {
	kind: "literal";
	text: string;
}

/**
 * Унифицированный сегмент маски даты/времени.
 */
export type DateMaskSegment = EditableDateSegment | LiteralDateSegment;

type EditableTokenConfig = Omit<EditableDateSegment, "kind" | "token">;

const TOKEN_MAP: Record<string, EditableTokenConfig> = {
	YYYY: { id: "year", length: 4, min: 1, max: 9999, placeholder: "ГГГГ", ariaLabel: "Год" },
	yyyy: { id: "year", length: 4, min: 1, max: 9999, placeholder: "гггг", ariaLabel: "Год" },
	yy: { id: "year", length: 2, min: 0, max: 99, placeholder: "гг", ariaLabel: "Год" },
	MM: { id: "month", length: 2, min: 1, max: 12, placeholder: "мм", ariaLabel: "Месяц" },
	DD: { id: "day", length: 2, min: 1, max: 31, placeholder: "ДД", ariaLabel: "День" },
	dd: { id: "day", length: 2, min: 1, max: 31, placeholder: "дд", ariaLabel: "День" },
	hh: { id: "hours", length: 2, min: 0, max: 23, placeholder: "чч", ariaLabel: "Часы" },
	HH: { id: "hours", length: 2, min: 0, max: 23, placeholder: "чч", ariaLabel: "Часы" },
	mm: { id: "minutes", length: 2, min: 0, max: 59, placeholder: "мм", ariaLabel: "Минуты" },
	ss: { id: "seconds", length: 2, min: 0, max: 59, placeholder: "сс", ariaLabel: "Секунды" }
};

const TOKENS_SORTED = Object.keys(TOKEN_MAP).sort((left, right) => right.length - left.length);

/**
 * Разворачивает строковую маску в последовательность литер и редактируемых сегментов.
 */
export function parseDateSegmentMask(mask: string): DateMaskSegment[] {
	const segments: DateMaskSegment[] = [];
	let position = 0;
	let literalBuffer = "";

	const flushLiteral = () => {
		if (!literalBuffer) return;

		segments.push({ kind: "literal", text: literalBuffer });
		literalBuffer = "";
	};

	while (position < mask.length) {
		let matchedToken: string | null = null;

		for (const token of TOKENS_SORTED) {
			if (mask.slice(position, position + token.length) === token) {
				matchedToken = token;
				break;
			}
		}

		if (!matchedToken) {
			literalBuffer += mask[position];
			position += 1;
			continue;
		}

		flushLiteral();
		segments.push({ kind: "editable", token: matchedToken, ...TOKEN_MAP[matchedToken] });
		position += matchedToken.length;
	}

	flushLiteral();

	return segments;
}

/**
 * Возвращает `true`, если сегмент редактируемый.
 */
export function isEditableDateSegment(segment: DateMaskSegment): segment is EditableDateSegment {
	return segment.kind === "editable";
}

/**
 * Преобразует Date в индексированную карту значений сегментов.
 */
export function dateToIndexedSegmentValues(date: Date | null | undefined, segments: DateMaskSegment[]): Map<number, string> {
	const values = new Map<number, string>();

	segments.forEach((segment, index) => {
		if (!isEditableDateSegment(segment)) return;

		if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
			values.set(index, "");
			return;
		}

		const rawValue = resolveSegmentValue(date, segment);
		values.set(index, rawValue);
	});

	return values;
}

/**
 * Возвращает `true`, если все редактируемые сегменты пусты.
 */
export function areAllDateSegmentsEmpty(segments: DateMaskSegment[], values: Map<number, string>): boolean {
	return segments.every((segment, index) => !isEditableDateSegment(segment) || !(values.get(index) ?? ""));
}

/**
 * Собирает строгий Date из индексированной карты сегментов.
 *
 * Отсутствующие части берутся из `defaultDate`, что сохраняет обратную
 * совместимость со сценариями ввода только даты или только времени.
 */
export function indexedSegmentsToDate(
	segments: DateMaskSegment[],
	values: Map<number, string>,
	options?: { defaultDate?: Date }
): Date | null {
	const editableSegments = segments
		.map((segment, index) => ({ segment, index }))
		.filter((entry): entry is { segment: EditableDateSegment; index: number } => isEditableDateSegment(entry.segment));

	for (const { segment, index } of editableSegments) {
		const value = values.get(index) ?? "";
		if (value.length < segment.length) return null;
	}

	const fallbackDate = options?.defaultDate ?? new Date(1970, 0, 1, 0, 0, 0, 0);
	const year = resolveSegmentNumber(editableSegments, values, "year") ?? fallbackDate.getFullYear();
	const month = resolveSegmentNumber(editableSegments, values, "month") ?? fallbackDate.getMonth() + 1;
	const day = resolveSegmentNumber(editableSegments, values, "day") ?? fallbackDate.getDate();
	const hours = resolveSegmentNumber(editableSegments, values, "hours") ?? fallbackDate.getHours();
	const minutes = resolveSegmentNumber(editableSegments, values, "minutes") ?? fallbackDate.getMinutes();
	const seconds = resolveSegmentNumber(editableSegments, values, "seconds") ?? fallbackDate.getSeconds();

	if (month < 1 || month > 12) return null;
	if (day < 1 || day > 31) return null;
	if (hours < 0 || hours > 23) return null;
	if (minutes < 0 || minutes > 59) return null;
	if (seconds < 0 || seconds > 59) return null;

	const result = new Date(year, month - 1, day, hours, minutes, seconds, 0);
	const isValid =
		result.getFullYear() === year &&
		result.getMonth() === month - 1 &&
		result.getDate() === day &&
		result.getHours() === hours &&
		result.getMinutes() === minutes &&
		result.getSeconds() === seconds;

	return isValid ? result : null;
}

/**
 * Возвращает строковое значение конкретного сегмента для переданного Date.
 */
function resolveSegmentValue(date: Date, segment: EditableDateSegment): string {
	const fullYear = String(date.getFullYear());

	switch (segment.id) {
		case "year":
			return segment.length === 2 ? fullYear.slice(-2) : fullYear.padStart(segment.length, "0");
		case "month":
			return String(date.getMonth() + 1).padStart(segment.length, "0");
		case "day":
			return String(date.getDate()).padStart(segment.length, "0");
		case "hours":
			return String(date.getHours()).padStart(segment.length, "0");
		case "minutes":
			return String(date.getMinutes()).padStart(segment.length, "0");
		case "seconds":
			return String(date.getSeconds()).padStart(segment.length, "0");
	}
}

/**
 * Извлекает числовое значение сегмента нужного типа.
 */
function resolveSegmentNumber(
	editableSegments: Array<{ segment: EditableDateSegment; index: number }>,
	values: Map<number, string>,
	targetId: DateSegmentId
): number | null {
	const match = editableSegments.find(({ segment }) => segment.id === targetId);
	if (!match) return null;

	const rawValue = values.get(match.index);
	if (!rawValue) return null;

	const numericValue = Number.parseInt(rawValue, 10);
	if (!Number.isFinite(numericValue)) return null;

	if (targetId === "year" && match.segment.length === 2) {
		return numericValue < 70 ? 2000 + numericValue : 1900 + numericValue;
	}

	return numericValue;
}

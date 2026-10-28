/** Виды и идентификаторы связывают маску, сборку даты и литеральные типы сегментов. */
const DATE_SEGMENT_ID_YEAR = "year";
const DATE_SEGMENT_ID_MONTH = "month";
const DATE_SEGMENT_ID_DAY = "day";
const DATE_SEGMENT_ID_HOURS = "hours";
const DATE_SEGMENT_ID_MINUTES = "minutes";
const DATE_SEGMENT_ID_SECONDS = "seconds";
const DATE_SEGMENT_KIND_EDITABLE = "editable";
const DATE_SEGMENT_KIND_LITERAL = "literal";
const DATE_SEGMENT_YEAR_LABEL = "Год";
const DATE_SEGMENT_DAY_LABEL = "День";
const DATE_SEGMENT_HOURS_LABEL = "Часы";
const DATE_SEGMENT_HOURS_PLACEHOLDER = "чч";

const DATE_SEGMENT_MAX_YEAR = 9999;
const DATE_SEGMENT_MAX_TWO_DIGIT_YEAR = 99;
const DATE_SEGMENT_MAX_MONTH = 12;
const DATE_SEGMENT_MAX_DAY = 31;
const DATE_SEGMENT_MAX_HOURS = 23;
const DATE_SEGMENT_MAX_MINUTES = 59;
const DATE_SEGMENT_MAX_SECONDS = 59;
const DATE_SEGMENT_FALLBACK_YEAR = 1970;
const DATE_SEGMENT_TWO_DIGIT_YEAR_PIVOT = 70;
const DATE_SEGMENT_PREVIOUS_CENTURY = 1900;
const DATE_SEGMENT_CURRENT_CENTURY = 2000;
/**
 * Нейтральные идентификаторы редактируемых сегментов даты и времени.
 */
export type DateSegmentId =
	| typeof DATE_SEGMENT_ID_YEAR
	| typeof DATE_SEGMENT_ID_MONTH
	| typeof DATE_SEGMENT_ID_DAY
	| typeof DATE_SEGMENT_ID_HOURS
	| typeof DATE_SEGMENT_ID_MINUTES
	| typeof DATE_SEGMENT_ID_SECONDS;

/**
 * Редактируемый сегмент маски даты/времени.
 */
export interface EditableDateSegment {
	kind: typeof DATE_SEGMENT_KIND_EDITABLE;
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
	kind: typeof DATE_SEGMENT_KIND_LITERAL;
	text: string;
}

/**
 * Унифицированный сегмент маски даты/времени.
 */
export type DateMaskSegment = EditableDateSegment | LiteralDateSegment;

type EditableTokenConfig = Omit<EditableDateSegment, "kind" | "token">;

const TOKEN_MAP: Record<string, EditableTokenConfig> = {
	YYYY: {
		id: DATE_SEGMENT_ID_YEAR,
		length: 4,
		min: 1,
		max: DATE_SEGMENT_MAX_YEAR,
		placeholder: "ГГГГ",
		ariaLabel: DATE_SEGMENT_YEAR_LABEL
	},
	yyyy: {
		id: DATE_SEGMENT_ID_YEAR,
		length: 4,
		min: 1,
		max: DATE_SEGMENT_MAX_YEAR,
		placeholder: "гггг",
		ariaLabel: DATE_SEGMENT_YEAR_LABEL
	},
	yy: {
		id: DATE_SEGMENT_ID_YEAR,
		length: 2,
		min: 0,
		max: DATE_SEGMENT_MAX_TWO_DIGIT_YEAR,
		placeholder: "гг",
		ariaLabel: DATE_SEGMENT_YEAR_LABEL
	},
	MM: { id: DATE_SEGMENT_ID_MONTH, length: 2, min: 1, max: DATE_SEGMENT_MAX_MONTH, placeholder: "мм", ariaLabel: "Месяц" },
	DD: { id: DATE_SEGMENT_ID_DAY, length: 2, min: 1, max: DATE_SEGMENT_MAX_DAY, placeholder: "ДД", ariaLabel: DATE_SEGMENT_DAY_LABEL },
	dd: { id: DATE_SEGMENT_ID_DAY, length: 2, min: 1, max: DATE_SEGMENT_MAX_DAY, placeholder: "дд", ariaLabel: DATE_SEGMENT_DAY_LABEL },
	hh: {
		id: DATE_SEGMENT_ID_HOURS,
		length: 2,
		min: 0,
		max: DATE_SEGMENT_MAX_HOURS,
		placeholder: DATE_SEGMENT_HOURS_PLACEHOLDER,
		ariaLabel: DATE_SEGMENT_HOURS_LABEL
	},
	HH: {
		id: DATE_SEGMENT_ID_HOURS,
		length: 2,
		min: 0,
		max: DATE_SEGMENT_MAX_HOURS,
		placeholder: DATE_SEGMENT_HOURS_PLACEHOLDER,
		ariaLabel: DATE_SEGMENT_HOURS_LABEL
	},
	mm: { id: DATE_SEGMENT_ID_MINUTES, length: 2, min: 0, max: DATE_SEGMENT_MAX_MINUTES, placeholder: "мм", ariaLabel: "Минуты" },
	ss: { id: DATE_SEGMENT_ID_SECONDS, length: 2, min: 0, max: DATE_SEGMENT_MAX_SECONDS, placeholder: "сс", ariaLabel: "Секунды" }
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

		segments.push({ kind: DATE_SEGMENT_KIND_LITERAL, text: literalBuffer });
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
		segments.push({ kind: DATE_SEGMENT_KIND_EDITABLE, token: matchedToken, ...TOKEN_MAP[matchedToken] });
		position += matchedToken.length;
	}

	flushLiteral();

	return segments;
}

/**
 * Возвращает `true`, если сегмент редактируемый.
 */
export function isEditableDateSegment(segment: DateMaskSegment): segment is EditableDateSegment {
	return segment.kind === DATE_SEGMENT_KIND_EDITABLE;
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

	const fallbackDate = options?.defaultDate ?? new Date(DATE_SEGMENT_FALLBACK_YEAR, 0, 1, 0, 0, 0, 0);
	const year = resolveSegmentNumber(editableSegments, values, DATE_SEGMENT_ID_YEAR) ?? fallbackDate.getFullYear();
	const month = resolveSegmentNumber(editableSegments, values, DATE_SEGMENT_ID_MONTH) ?? fallbackDate.getMonth() + 1;
	const day = resolveSegmentNumber(editableSegments, values, DATE_SEGMENT_ID_DAY) ?? fallbackDate.getDate();
	const hours = resolveSegmentNumber(editableSegments, values, DATE_SEGMENT_ID_HOURS) ?? fallbackDate.getHours();
	const minutes = resolveSegmentNumber(editableSegments, values, DATE_SEGMENT_ID_MINUTES) ?? fallbackDate.getMinutes();
	const seconds = resolveSegmentNumber(editableSegments, values, DATE_SEGMENT_ID_SECONDS) ?? fallbackDate.getSeconds();

	if (month < 1 || month > DATE_SEGMENT_MAX_MONTH) return null;
	if (day < 1 || day > DATE_SEGMENT_MAX_DAY) return null;
	if (hours < 0 || hours > DATE_SEGMENT_MAX_HOURS) return null;
	if (minutes < 0 || minutes > DATE_SEGMENT_MAX_MINUTES) return null;
	if (seconds < 0 || seconds > DATE_SEGMENT_MAX_SECONDS) return null;

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
		case DATE_SEGMENT_ID_YEAR:
			return segment.length === 2 ? fullYear.slice(-2) : fullYear.padStart(segment.length, "0");
		case DATE_SEGMENT_ID_MONTH:
			return String(date.getMonth() + 1).padStart(segment.length, "0");
		case DATE_SEGMENT_ID_DAY:
			return String(date.getDate()).padStart(segment.length, "0");
		case DATE_SEGMENT_ID_HOURS:
			return String(date.getHours()).padStart(segment.length, "0");
		case DATE_SEGMENT_ID_MINUTES:
			return String(date.getMinutes()).padStart(segment.length, "0");
		case DATE_SEGMENT_ID_SECONDS:
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

	if (targetId === DATE_SEGMENT_ID_YEAR && match.segment.length === 2) {
		return numericValue < DATE_SEGMENT_TWO_DIGIT_YEAR_PIVOT
			? DATE_SEGMENT_CURRENT_CENTURY + numericValue
			: DATE_SEGMENT_PREVIOUS_CENTURY + numericValue;
	}

	return numericValue;
}

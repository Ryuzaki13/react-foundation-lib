import { formatNumber, NUMBER_FORMAT_DEFAULTS, type NumberFormatPreset } from "./number";
import { COMPACT_ROUNDING_MODE_ROUND } from "./number/numberFormatConstants";

const FILE_SIZE_BASE = 1024;
/** Двоичные единицы соответствуют File.size и серверным лимитам в байтах. */
const FILE_SIZE_PRESET: NumberFormatPreset = {
	...NUMBER_FORMAT_DEFAULTS,
	name: "file-size",
	decimals: 0,
	compact: {
		minCompactValue: 1,
		maxDecimals: 2,
		roundingMode: COMPACT_ROUNDING_MODE_ROUND,
		units: [
			{ value: FILE_SIZE_BASE ** 5, suffix: "ПиБ" },
			{ value: FILE_SIZE_BASE ** 4, suffix: "ТиБ" },
			{ value: FILE_SIZE_BASE ** 3, suffix: "ГиБ" },
			{ value: FILE_SIZE_BASE ** 2, suffix: "МиБ" },
			{ value: FILE_SIZE_BASE, suffix: "КиБ" },
			{ value: 1, suffix: "Б" }
		]
	}
};

/**
 * Показывает неотрицательный размер в подходящих двоичных единицах,
 * до двух знаков после запятой. Маленький файл не превращается в «0 МиБ».
 * Отсутствие размера является состоянием потребителя, а не нулём байтов.
 */
export function formatFileSize(sizeBytes: number): string {
	if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0)
		throw new RangeError("Размер файла должен быть неотрицательным безопасным целым числом.");
	if (sizeBytes === 0) return "0 Б";
	// Выбор единицы определяется байтами: десятичный compact не должен
	// переносить 1000 Б в КиБ до достижения двоичного порога 1024.
	const unit = FILE_SIZE_PRESET.compact?.units?.find(({ value }) => sizeBytes >= value);
	return formatNumber(sizeBytes, {
		...FILE_SIZE_PRESET,
		compact: { ...FILE_SIZE_PRESET.compact, units: unit ? [unit] : [] }
	});
}

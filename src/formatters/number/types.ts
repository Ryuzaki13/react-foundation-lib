import {
	type COMPACT_ROUNDING_MODE_ROUND,
	type COMPACT_ROUNDING_MODE_FLOOR,
	type COMPACT_ROUNDING_MODE_CEIL,
	type COMPACT_ROUNDING_MODE_TRUNC
} from "./numberFormatConstants";

export type NumberFormatCompactRoundingMode =
	| typeof COMPACT_ROUNDING_MODE_ROUND
	| typeof COMPACT_ROUNDING_MODE_FLOOR
	| typeof COMPACT_ROUNDING_MODE_CEIL
	| typeof COMPACT_ROUNDING_MODE_TRUNC;

export type NumberFormatCompactUnit = {
	value: number;
	suffix: string;
};

export type NumberFormatCompactOptions = {
	/**
	 * Минимальное абсолютное значение, с которого включается компактный формат.
	 */
	minCompactValue?: number;

	/**
	 * Максимальное количество знаков после запятой для компактного значения.
	 */
	maxDecimals?: number;

	/**
	 * Режим округления компактного значения.
	 */
	roundingMode?: NumberFormatCompactRoundingMode;

	/**
	 * Разделитель между числом и суффиксом.
	 */
	suffixSeparator?: string;

	/**
	 * Набор компактных единиц.
	 */
	units?: readonly NumberFormatCompactUnit[];
};

/** Параметры предустановки форматирования чисел */
export interface NumberFormatPreset {
	name: string;
	/** Количество десятичных знаков */
	decimals: number;
	/** Разделитель дробной части */
	decimalSeparator: string;
	/** Группировка разрядов */
	grouping: boolean;
	/** Разделитель групп разрядов */
	groupingSeparator: string;
	/** Размер группы разрядов */
	groupingSize: number;
	/** Настройки компактного представления */
	compact?: NumberFormatCompactOptions;
}

/** Конфигурация для создания предустановки (все поля кроме name опциональны) */
export type NumberFormatPresetConfig = Partial<Omit<NumberFormatPreset, "name">> & Pick<NumberFormatPreset, "name">;

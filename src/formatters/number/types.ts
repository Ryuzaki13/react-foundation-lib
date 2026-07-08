export type NumberFormatCompactRoundingMode = "round" | "floor" | "ceil" | "trunc";

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

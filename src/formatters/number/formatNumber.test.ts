import { afterEach, describe, expect, it } from "vitest";

import {
	formatCompactNumber,
	formatNumberAsChartAxis,
	formatNumberAsChartTooltip,
	formatNumberAsCompact,
	formatNumberAsCompactCurrency,
	formatNumberAsCurrencyChartAxis,
	formatNumberAsCurrencyChartTooltip
} from "./formatCompactNumber";

import type { NumberFormatPreset } from "./types";

import { truncateNumber } from "./formatNumber";
import {
	clearFormatCache,
	formatNumber,
	formatNumberAsCurrency,
	formatNumberAsCurrencyOrEmpty,
	formatNumberAsDecimal,
	formatNumberAsDecimal2,
	formatNumberAsDecimal2OrEmpty,
	formatNumberAsDecimal3,
	formatNumberAsDecimal3OrEmpty,
	formatNumberAsDecimalOrEmpty,
	formatNumberAsInteger,
	formatNumberAsIntegerOrEmpty,
	formatNumberAsPercent,
	formatNumberAsPercentOrEmpty,
	formatNumberAsPrice,
	formatNumberAsPriceOrEmpty,
	formatNumberAsTonnage,
	formatNumberAsTonnageOrEmpty,
	getNumberPreset,
	getNumberPresetNames,
	isZeroValue,
	NUMBER_FORMAT_DEFAULTS,
	registerNumberPreset,
	resetNumberPresets
} from "./index";

/** Неразрывный пробел из ru-RU (для читаемости ожиданий в тестах) */
const S = NUMBER_FORMAT_DEFAULTS.groupingSeparator;

afterEach(() => {
	resetNumberPresets();
	clearFormatCache();
});

describe("реестр предустановок", () => {
	const defaultPresets = [
		"integer",
		"decimal",
		"decimal-2",
		"decimal-3",
		"currency",
		"price",
		"percent",
		"tonnage",
		"compact-currency",
		"compact-percent",
		"compact-tonnage"
	];
	it("содержит все типовые предустановки", () => {
		expect(getNumberPresetNames()).toEqual(defaultPresets);
	});

	it("getPreset возвращает предустановку по имени", () => {
		expect(getNumberPreset("integer")).toEqual({
			name: "integer",
			decimals: 0,
			decimalSeparator: "",
			grouping: true,
			groupingSeparator: S,
			groupingSize: 3
		});
	});

	it("getPreset возвращает undefined для несуществующего имени", () => {
		expect(getNumberPreset("Unknown")).toBeUndefined();
	});

	it("getPreset возвращает компактную предустановку", () => {
		expect(getNumberPreset("compact-currency")).toEqual({
			name: "compact-currency",
			decimals: 0,
			decimalSeparator: "",
			grouping: true,
			groupingSeparator: S,
			groupingSize: 3,
			compact: {}
		});
	});

	it("registerPreset добавляет предустановку, заполняя пропуски из FORMAT_DEFAULTS", () => {
		const preset = registerNumberPreset({ name: "Custom", decimals: 4, decimalSeparator: "." });
		expect(preset).toEqual({ ...NUMBER_FORMAT_DEFAULTS, name: "Custom", decimals: 4, decimalSeparator: "." });
		expect(getNumberPreset("Custom")).toEqual(preset);
	});

	it("registerPreset перезаписывает существующую предустановку", () => {
		registerNumberPreset({ name: "integer", decimals: 5 });
		expect(getNumberPreset("integer")?.decimals).toBe(5);
	});

	it("resetPresets восстанавливает только типовые предустановки", () => {
		registerNumberPreset({ name: "Custom" });
		expect(getNumberPresetNames()).toContain("Custom");

		resetNumberPresets();
		expect(getNumberPresetNames()).not.toContain("Custom");
		expect(getNumberPresetNames()).toHaveLength(defaultPresets.length);
	});
});

describe("форматирование с типовыми предустановками", () => {
	it("integer: целое число с группировкой неразрывными пробелами", () => {
		expect(formatNumber(1234567, "integer")).toBe(`1${S}234${S}567`);
	});

	it("integer: нулевое значение", () => {
		expect(formatNumber(0, "integer")).toBe("0");
	});

	it("integer: отрицательное число", () => {
		expect(formatNumber(-9876543, "integer")).toBe(`-9${S}876${S}543`);
	});

	it("integer: дробная часть округляется", () => {
		expect(formatNumber(1234.789, "integer")).toBe(`1${S}235`);
	});

	it("decimal: один десятичный знак с запятой (округление)", () => {
		expect(formatNumber(1234567.891, "decimal")).toBe(`1${S}234${S}567,9`);
	});

	it("decimal: добивает нулями до нужного кол-ва знаков", () => {
		expect(formatNumber(100, "decimal")).toBe("100,0");
	});

	it("decimal 2: добивает нулями до нужного кол-ва знаков", () => {
		expect(formatNumber(100, "decimal-2")).toBe("100,00");
	});

	it("decimal-3: добивает нулями до нужного кол-ва знаков", () => {
		expect(formatNumber(100, "decimal-3")).toBe("100,000");
	});

	it("currency: целое число с группировкой", () => {
		expect(formatNumber(5000000, "currency")).toBe(`5${S}000${S}000`);
	});

	it("price: целое число с группировкой", () => {
		expect(formatNumber(42000, "price")).toBe(`42${S}000`);
	});

	it("percent: два десятичных знака", () => {
		expect(formatNumber(99.1, "percent")).toBe("99,10");
	});

	it("percent: усечение до 2 знаков", () => {
		expect(formatNumber(33.3399, "percent")).toBe("33,34");
	});

	it("tonnage: один десятичный знак (округление)", () => {
		expect(formatNumber(15000.75, "tonnage")).toBe(`15${S}000,8`);
	});

	it("публичные wrappers используют свои предустановки", () => {
		expect(formatNumberAsInteger(1234.5)).toBe(`1${S}235`);
		expect(formatNumberAsCurrency(1234)).toBe(`1${S}234`);
		expect(formatNumberAsDecimal(1.25)).toBe("1,3");
		expect(formatNumberAsDecimal2(1.25)).toBe("1,25");
		expect(formatNumberAsDecimal3(1.25)).toBe("1,250");
		expect(formatNumberAsPercent(1.2)).toBe("1,20");
		expect(formatNumberAsPrice(1234)).toBe(`1${S}234`);
		expect(formatNumberAsTonnage(1.25)).toBe("1,3");
	});

	it("empty-wrappers скрывают только семантический ноль", () => {
		expect(formatNumberAsIntegerOrEmpty(0)).toBe("");
		expect(formatNumberAsCurrencyOrEmpty("0")).toBe("");
		expect(formatNumberAsDecimalOrEmpty(0)).toBe("");
		expect(formatNumberAsDecimal2OrEmpty(0)).toBe("");
		expect(formatNumberAsDecimal3OrEmpty(0)).toBe("");
		expect(formatNumberAsPercentOrEmpty(0)).toBe("");
		expect(formatNumberAsPriceOrEmpty(0)).toBe("");
		expect(formatNumberAsTonnageOrEmpty(0)).toBe("");
		expect(formatNumberAsIntegerOrEmpty(1)).toBe("1");
	});

	it("isZeroValue проверяет только числовые нули", () => {
		expect(isZeroValue(0)).toBe(true);
		expect(isZeroValue("0")).toBe(true);
		expect(isZeroValue(false)).toBe(false);
		expect(isZeroValue("abc")).toBe(false);
	});

	it("truncateNumber усекает к нулю с заданной точностью", () => {
		expect(truncateNumber(12.987, 2)).toBe(12.98);
		expect(truncateNumber(-12.987, 2)).toBe(-12.98);
		expect(truncateNumber(12.987, 0)).toBe(12);
	});
});

describe("компактные предустановки", () => {
	it("compact-currency: значение ниже порога форматируется как обычная currency-предустановка", () => {
		expect(formatNumber(999, "compact-currency")).toBe("999");
	});

	it("compact-currency: четырёхзначное значение форматируется компактно", () => {
		expect(formatNumber(1234, "compact-currency")).toBe("1,2 тыс");
	});

	it("compact-currency: тысячи форматируются с суффиксом", () => {
		expect(formatNumber(34823, "compact-currency")).toBe("34 тыс");
	});

	it("compact-currency: миллионы сохраняют значащую десятичную часть", () => {
		expect(formatNumber(1534000, "compact-currency")).toBe("1,5 млн");
	});

	it("compact-currency: отрицательное значение сохраняет знак", () => {
		expect(formatNumber(-1534000, "compact-currency")).toBe("-1,5 млн");
	});

	it("compact-percent: ниже порога использует два знака после запятой", () => {
		expect(formatNumber(999.99, "compact-percent")).toBe("999,99");
	});

	it("compact-percent: выше порога использует компактную шкалу", () => {
		expect(formatNumber(12345.67, "compact-percent")).toBe("12,34 тыс");
	});

	it("compact-tonnage: ниже порога использует один знак после запятой", () => {
		expect(formatNumber(999.94, "compact-tonnage")).toBe("999,9");
	});

	it("compact-tonnage: выше порога использует компактную шкалу", () => {
		expect(formatNumber(9500000, "compact-tonnage")).toBe("9,5 млн");
	});

	it("кастомный compact-пресет поддерживает maxDecimals", () => {
		registerNumberPreset({ name: "compact-custom", decimals: 0, compact: { maxDecimals: 2 } });
		expect(formatNumber(1239999, "compact-custom")).toBe("1,23 млн");
	});

	it("кастомный compact-пресет переносит 1000 тыс в следующую единицу при округлении", () => {
		registerNumberPreset({ name: "compact-round", decimals: 0, compact: { roundingMode: "round" } });
		expect(formatNumber(999999, "compact-round")).toBe("1 млн");
	});

	it("formatCompactNumber использует общий compact-механизм и сохраняет SAP-like парсинг строк", () => {
		expect(formatCompactNumber("1 234,5", "currency", { minCompactValue: 1000 })).toBe("1,2 тыс");
	});

	it("публичные compact wrappers разделяют axis и tooltip форматирование", () => {
		expect(formatNumberAsCompact(34_823)).toBe("34 тыс");
		expect(formatNumberAsCompactCurrency(1_534_000)).toBe("1,5 млн");
		expect(formatNumberAsChartAxis(9_999)).toBe(`9${S}999`);
		expect(formatNumberAsChartAxis(10_000)).toBe("10 тыс");
		expect(formatNumberAsChartTooltip(10_000)).toBe(`10${S}000`);
		expect(formatNumberAsCurrencyChartAxis(1_534_000)).toBe("1,5 млн");
		expect(formatNumberAsCurrencyChartTooltip(1_534_000)).toBe(`1${S}534${S}000`);
	});
});

describe("SAP-совместимый ввод (строки)", () => {
	it("строковое число форматируется корректно", () => {
		expect(formatNumber("1234567", "integer")).toBe(`1${S}234${S}567`);
	});

	it("строка с ведущими нулями", () => {
		expect(formatNumber("00123.4", "decimal")).toBe("123,4");
	});

	it("пустая строка возвращается как есть", () => {
		expect(formatNumber("", "integer")).toBe("0");
	});

	it("строка с пробелами возвращается как есть", () => {
		expect(formatNumber("   ", "integer")).toBe("0");
	});

	it("нечисловая строка возвращается без изменений", () => {
		expect(formatNumber("abc", "integer")).toBe("0");
	});
});

describe("граничные значения", () => {
	it("NaN возвращается строковым представлением", () => {
		expect(formatNumber(NaN, "integer")).toBe("0");
	});

	it("Infinity возвращается строковым представлением", () => {
		expect(formatNumber(Infinity, "integer")).toBe("0");
	});

	it("-Infinity возвращается строковым представлением", () => {
		expect(formatNumber(-Infinity, "integer")).toBe("0");
	});

	it("очень большое число форматируется корректно", () => {
		expect(formatNumber(1_000_000_000, "integer")).toBe(`1${S}000${S}000${S}000`);
	});

	it("маленькое дробное число (округление)", () => {
		expect(formatNumber(0.005, "percent")).toBe("0,01");
	});

	it("отрицательное дробное число (округление к нулю)", () => {
		expect(formatNumber(-1234.56, "decimal")).toBe(`-1${S}234,6`);
	});
});

describe("обработка ошибок", () => {
	it("выбрасывает ошибку при неизвестном имени предустановки", () => {
		expect(() => formatNumber(100, "NonExistent")).toThrowError('Предустановка "NonExistent" не найдена');
	});
});

describe("форматирование с объектом предустановки напрямую", () => {
	it("принимает объект NumberFormatPreset вместо имени", () => {
		const preset: NumberFormatPreset = {
			name: "inline",
			decimals: 3,
			decimalSeparator: ".",
			grouping: true,
			groupingSeparator: ",",
			groupingSize: 3
		};
		expect(formatNumber(1234567.891, preset)).toBe("1,234,567.891");
	});

	it("без группировки", () => {
		const preset: NumberFormatPreset = {
			name: "nogroup",
			decimals: 2,
			decimalSeparator: ".",
			grouping: false,
			groupingSeparator: "",
			groupingSize: 3
		};
		expect(formatNumber(1234567.891, preset)).toBe("1234567.89");
	});
});

describe("нестандартный размер группы", () => {
	it("groupingSize = 4", () => {
		const preset: NumberFormatPreset = {
			name: "group4",
			decimals: 0,
			decimalSeparator: "",
			grouping: true,
			groupingSeparator: " ",
			groupingSize: 4
		};
		expect(formatNumber(123456789, preset)).toBe("1 2345 6789");
	});

	it("groupingSize = 2", () => {
		const preset: NumberFormatPreset = {
			name: "group2",
			decimals: 1,
			decimalSeparator: ",",
			grouping: true,
			groupingSeparator: ".",
			groupingSize: 2
		};
		expect(formatNumber(123456.7, preset)).toBe("12.34.56,7");
	});

	it("groupingSize нестандартный с отрицательным числом", () => {
		const preset: NumberFormatPreset = {
			name: "group4neg",
			decimals: 2,
			decimalSeparator: ",",
			grouping: true,
			groupingSeparator: " ",
			groupingSize: 4
		};
		expect(formatNumber(-12345678.9, preset)).toBe("-1234 5678,90");
	});
});

describe("кеш Intl.NumberFormat", () => {
	it("clearFormatCache не ломает форматирование", () => {
		expect(formatNumber(1000, "integer")).toBe(`1${S}000`);
		clearFormatCache();
		expect(formatNumber(1000, "integer")).toBe(`1${S}000`);
	});

	it("повторные вызовы дают стабильный результат (кеш)", () => {
		const results: string[] = [];
		for (let i = 0; i < 100; i++) {
			results.push(formatNumber(123456.789, "decimal"));
		}
		expect(new Set(results).size).toBe(1);
		expect(results[0]).toBe(`123${S}456,8`);
	});
});

describe("кастомные предустановки в рантайме", () => {
	it("зарегистрированная предустановка доступна по имени", () => {
		registerNumberPreset({ name: "Weight", decimals: 3, decimalSeparator: ".", groupingSeparator: "," });
		expect(formatNumber(9876543.21, "Weight")).toBe("9,876,543.210");
	});

	it("перерегистрация с новыми параметрами обновляет форматирование", () => {
		registerNumberPreset({ name: "TestPreset", decimals: 0 });
		expect(formatNumber(1234.5, "TestPreset")).toBe(`1${S}235`);

		registerNumberPreset({ name: "TestPreset", decimals: 2, decimalSeparator: "." });
		expect(formatNumber(1234.5, "TestPreset")).toBe(`1${S}234.50`);
	});
});

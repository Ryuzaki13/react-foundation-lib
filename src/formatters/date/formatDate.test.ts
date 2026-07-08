import { afterEach, describe, expect, it } from "vitest";

import {
	DEFAULT_DATE_PRESET_NAMES,
	formatDate,
	formatDateAsAbapDate,
	formatDateAsAbapDatetime,
	formatDateAsDate,
	formatDateAsDateLong,
	formatDateAsDateMedium,
	formatDateAsDateShort,
	formatDateAsDateTime,
	formatDateAsDatetimeLong,
	formatDateAsDatetimeMedium,
	formatDateAsDatetimeShort,
	formatDateAsMonthLong,
	formatDateAsMonthShort,
	formatDateAsODataDate,
	formatDateAsODataDatetime,
	formatDateAsODataTime,
	formatDateAsTime,
	formatDateAsTimeLong,
	formatDateAsTimeMedium,
	formatDateAsTimeSeconds,
	formatDateAsTimeShort,
	formatDateRange,
	getDatePreset,
	getDatePresetNames,
	isDateFormatPrecision,
	isDateFormatStyle,
	parseDateByPattern,
	parseDateValue,
	registerDatePreset,
	resetDatePresets,
	resolveDateFormatName,
	resolveDateFormatPreset
} from "./index";

/**
 * Возвращает снимок календарных компонентов даты без влияния timezone.
 */
function getCalendarSnapshot(date: Date): string {
	const year = String(date.getFullYear());
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	const seconds = String(date.getSeconds()).padStart(2, "0");

	return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

const BASE_LOCAL_DATE = new Date(2026, 2, 3, 18, 3, 50, 327);
const BASE_ISO_LOCAL = "2026-03-03T18:03:50.327";
const BASE_ISO_ZONED = "2026-03-03T18:03:50.327Z";

afterEach(() => {
	resetDatePresets();
});

describe("реестр предустановок", () => {
	it("содержит встроенные предустановки", () => {
		expect(getDatePresetNames()).toEqual([
			"date",
			"datetime",
			"datetime-seconds",
			"time",
			"time-seconds",
			"date-short",
			"date-medium",
			"date-long",
			"month-short",
			"month-long",
			"time-short",
			"time-medium",
			"time-long",
			"datetime-short",
			"datetime-medium",
			"datetime-long",
			"odata-date",
			"odata-datetime",
			"abap-datetime",
			"abap-date",
			"abap-month",
			"abap-year"
		]);
	});

	it("позволяет регистрировать пользовательскую предустановку", () => {
		registerDatePreset({ name: "machine", pattern: "yyyy-MM-ddTHH:mm:ss" });
		expect(formatDate(BASE_LOCAL_DATE, "machine")).toBe("2026-03-03T18:03:50");
	});

	it("разрешает style alias, precision guards и ручной pattern preset с кешированием", () => {
		const firstPatternPreset = resolveDateFormatPreset(" yyyy/MM/dd ", {
			patternPresetName: "manual",
			locale: "ru-RU",
			invalidFallback: "н/д"
		});
		const secondPatternPreset = resolveDateFormatPreset("yyyy/MM/dd", {
			patternPresetName: "manual",
			locale: "ru-RU",
			invalidFallback: "н/д"
		});

		expect(resolveDateFormatName(undefined, DEFAULT_DATE_PRESET_NAMES.datetime)).toBe("datetime");
		expect(resolveDateFormatName("medium")).toBe("date-medium");
		expect(resolveDateFormatPreset("short")).toBe("date-short");
		expect(firstPatternPreset).toBe(secondPatternPreset);
		expect(firstPatternPreset).toMatchObject({
			name: "manual:yyyy/MM/dd",
			pattern: "yyyy/MM/dd",
			invalidFallback: "н/д"
		});
		expect(isDateFormatStyle("short")).toBe(true);
		expect(isDateFormatStyle("full")).toBe(false);
		expect(isDateFormatPrecision("month")).toBe(true);
		expect(isDateFormatPrecision("quarter")).toBe(false);
		expect(getDatePreset("missing")).toBeUndefined();
	});

	it("компилирует пользовательскую Intl date+time предустановку с joiner по умолчанию", () => {
		registerDatePreset({
			name: "joined",
			locale: "en-GB",
			intlDateOptions: { year: "numeric" },
			intlTimeOptions: { hour: "2-digit", hourCycle: "h23" },
			invalidFallback: ""
		});

		expect(formatDate(BASE_LOCAL_DATE, "joined")).toBe("2026 18");
	});
});

describe("форматирование дат в плавающей календарной семантике", () => {
	it("форматирует Date, созданный локальным конструктором, без изменения видимых компонентов", () => {
		expect(
			formatDate(new Date(2026, 2, 5, 12, 34, 56), {
				name: "machine",
				pattern: "yyyy-MM-ddTHH:mm:ss",
				locale: "ru-RU",
				invalidFallback: ""
			})
		).toBe("2026-03-05T12:34:56");
	});

	it("форматирует ISO-строку без timezone без изменения видимых компонентов", () => {
		expect(
			formatDate("2026-03-05T12:34:56", {
				name: "machine",
				pattern: "yyyy-MM-ddTHH:mm:ss",
				locale: "ru-RU",
				invalidFallback: ""
			})
		).toBe("2026-03-05T12:34:56");
	});

	it("форматирует ISO-строку c Z без timezone-сдвига", () => {
		expect(
			formatDate("2026-03-05T12:34:56.000Z", {
				name: "machine",
				pattern: "yyyy-MM-ddTHH:mm:ss",
				locale: "ru-RU",
				invalidFallback: ""
			})
		).toBe("2026-03-05T12:34:56");
	});

	it("форматирует ISO-строку со смещением без пересчета времени", () => {
		expect(
			formatDate("2026-03-05T12:34:56+05:00", {
				name: "machine",
				pattern: "yyyy-MM-ddTHH:mm:ss",
				locale: "ru-RU",
				invalidFallback: ""
			})
		).toBe("2026-03-05T12:34:56");
	});

	it("форматирует Date, созданный из строки без timezone, как те же видимые компоненты", () => {
		expect(
			formatDate(new Date("2026-03-05T12:34:56"), {
				name: "machine",
				pattern: "yyyy-MM-ddTHH:mm:ss",
				locale: "ru-RU",
				invalidFallback: ""
			})
		).toBe("2026-03-05T12:34:56");
	});

	it("форматирует OData literal datetimeoffset без пересчета времени", () => {
		expect(formatDate("datetimeoffset'2026-03-03T18:03:50.327Z'", "datetime")).toBe("03.03.2026 18:03");
	});

	it("форматирует OData literal datetime без пересчета времени", () => {
		expect(formatDate("datetime'2026-03-03T18:03:50'", "datetime")).toBe("03.03.2026 18:03");
	});

	it("форматирует компактную ABAP дату YYYYMMDD", () => {
		expect(formatDate("20260303", "date")).toBe("03.03.2026");
	});

	it("форматирует дату DD.MM.YYYY", () => {
		expect(formatDate("03.03.2026", "date")).toBe("03.03.2026");
	});

	it("форматирует дату MM/DD/YYYY", () => {
		expect(formatDate("03/03/2026", "date")).toBe("03.03.2026");
	});

	it("игнорирует timezone-настройки Intl в объектной предустановке", () => {
		expect(
			formatDate("2026-03-05T12:34:56.000Z", {
				name: "unsafe-timezone",
				locale: "ru-RU",
				invalidFallback: "",
				intlOptions: {
					hour: "2-digit",
					minute: "2-digit",
					hourCycle: "h23",
					timeZone: "Pacific/Kiritimati",
					timeZoneName: "short"
				}
			})
		).toBe("12:34");
	});

	it("нормализует timeStyle long без вывода timezoneName", () => {
		expect(
			formatDate("2026-03-05T12:34:56.000Z", {
				name: "long-time-style",
				locale: "ru-RU",
				invalidFallback: "",
				intlOptions: {
					dateStyle: "long",
					timeStyle: "long",
					timeZone: "Pacific/Kiritimati"
				}
			})
		).toBe("5 марта 2026 г., 12:34:56");
	});

	it("кеширует объектную предустановку при повторном форматировании", () => {
		const preset = {
			name: "object-preset",
			locale: "ru-RU",
			invalidFallback: "",
			pattern: "yyyy-MM-dd"
		};

		expect(formatDate(BASE_LOCAL_DATE, preset)).toBe("2026-03-03");
		expect(formatDate(BASE_LOCAL_DATE, preset)).toBe("2026-03-03");
	});

	it("форматирует timeStyle без dateStyle как чистое время", () => {
		expect(
			formatDate(BASE_LOCAL_DATE, {
				name: "time-style",
				locale: "ru-RU",
				invalidFallback: "",
				intlOptions: {
					timeStyle: "short"
				}
			})
		).toBe("18:03");
	});
});

describe("Intl style-пресеты без timezone-семантики", () => {
	it("форматирует dateStyle-подобные пресеты ru-RU", () => {
		expect(formatDate(BASE_LOCAL_DATE, "date-short")).toBe("03.03.2026");
		expect(formatDate(BASE_LOCAL_DATE, "date-medium")).toBe("3 мар. 2026 г.");
		expect(formatDate(BASE_LOCAL_DATE, "date-long")).toBe("3 марта 2026 г.");
	});

	it("форматирует day+month пресеты ru-RU без года", () => {
		expect(formatDate(new Date(2026, 4, 25), "month-long")).toBe("25 мая");
		expect(formatDate(new Date(2026, 5, 25), "month-long")).toBe("25 июня");

		expect(formatDate(new Date(2026, 4, 25), "month-short")).toBe("25 мая");
		expect(formatDate(new Date(2026, 5, 25), "month-short")).toBe("25 июн.");
	});

	it("форматирует timeStyle-подобные пресеты ru-RU без timezoneName", () => {
		expect(formatDate(BASE_LOCAL_DATE, "time-short")).toBe("18:03");
		expect(formatDate(BASE_LOCAL_DATE, "time-medium")).toBe("18:03:50");
		expect(formatDate(BASE_LOCAL_DATE, "time-long")).toBe("18:03:50");
	});

	it("форматирует datetime style-пресеты ru-RU без timezoneName", () => {
		expect(formatDate(BASE_LOCAL_DATE, "datetime-short")).toBe("03.03.2026, 18:03");
		expect(formatDate(BASE_LOCAL_DATE, "datetime-medium")).toBe("3 мар. 2026 г., 18:03:50");
		expect(formatDate(BASE_LOCAL_DATE, "datetime-long")).toBe("3 марта 2026 г., 18:03:50");
	});
});

describe("поддержка OData ticks", () => {
	it("форматирует OData ticks без offset, сохраняя календарные компоненты", () => {
		const timestamp = Date.UTC(2026, 2, 3, 18, 3, 50, 327);
		expect(formatDate(`/Date(${timestamp})/`, "datetime")).toBe("03.03.2026 18:03");
	});

	it("форматирует OData ticks с offset, сохраняя сервисное время", () => {
		const timestamp = Date.UTC(2026, 2, 3, 15, 3, 50, 327);
		expect(formatDate(`/Date(${timestamp}+0300)/`, "datetime")).toBe("03.03.2026 18:03");
	});
});

describe("поддержка ISO-длительности", () => {
	it("форматирует PT-длительность в шаблон времени", () => {
		expect(formatDate("PT18H03M50S", "time")).toBe("18:03");
	});

	it("форматирует длительность с сутками в часы", () => {
		expect(formatDate("P1DT2H3M4S", "time-seconds")).toBe("26:03:04");
	});

	it("возвращает fallback, если длительность форматируется в шаблон даты", () => {
		expect(formatDate("PT12H", "date")).toBe("");
		expect(formatDate("PT12H", "date", { fallback: "н/д" })).toBe("н/д");
	});

	it("форматирует длительность по пользовательскому time pattern", () => {
		expect(
			formatDate("PT2H3M4S", {
				name: "duration-label",
				pattern: "HH часов mm минут ss секунд",
				locale: "ru-RU",
				invalidFallback: ""
			})
		).toBe("02 часов 03 минут 04 секунд");
		expect(
			formatDate("PT2H", {
				name: "duration-invalid",
				pattern: "duration",
				locale: "ru-RU",
				invalidFallback: "н/д"
			})
		).toBe("н/д");
	});
});

describe("fallback и ошибки", () => {
	it("возвращает пустую строку для невалидного значения", () => {
		expect(formatDate("abc", "datetime")).toBe("");
		expect(formatDate(null, "datetime")).toBe("");
	});

	it("поддерживает переопределение fallback в опциях вызова", () => {
		expect(formatDate("abc", "datetime", { fallback: "н/д" })).toBe("н/д");
	});

	it("выбрасывает ошибку при неизвестной предустановке", () => {
		expect(() => formatDate(BASE_LOCAL_DATE, "missing")).toThrowError('Предустановка даты "missing" не найдена');
	});
});

describe("дополнительные API", () => {
	it("форматирует через helper-функции", () => {
		expect(formatDateAsDate(BASE_LOCAL_DATE)).toBe("03.03.2026");
		expect(formatDateAsDateTime(BASE_LOCAL_DATE)).toBe("03.03.2026 18:03");
		expect(formatDateAsDateShort(BASE_LOCAL_DATE)).toBe("03.03.2026");
		expect(formatDateAsDateMedium(BASE_LOCAL_DATE)).toBe("3 мар. 2026 г.");
		expect(formatDateAsDateLong(BASE_LOCAL_DATE)).toBe("3 марта 2026 г.");
		expect(formatDateAsMonthLong(BASE_LOCAL_DATE)).toBe("3 марта");
		expect(formatDateAsMonthShort(BASE_LOCAL_DATE)).toBe("3 мар.");
		expect(formatDateAsTime(BASE_LOCAL_DATE)).toBe("18:03");
		expect(formatDateAsTimeSeconds(BASE_LOCAL_DATE)).toBe("18:03:50");
		expect(formatDateAsTimeShort(BASE_LOCAL_DATE)).toBe("18:03");
		expect(formatDateAsTimeMedium(BASE_LOCAL_DATE)).toBe("18:03:50");
		expect(formatDateAsTimeLong(BASE_LOCAL_DATE)).toBe("18:03:50");
		expect(formatDateAsDatetimeShort(BASE_LOCAL_DATE)).toBe("03.03.2026, 18:03");
		expect(formatDateAsDatetimeMedium(BASE_LOCAL_DATE)).toBe("3 мар. 2026 г., 18:03:50");
		expect(formatDateAsDatetimeLong(BASE_LOCAL_DATE)).toBe("3 марта 2026 г., 18:03:50");
		expect(formatDateAsAbapDate(BASE_LOCAL_DATE)).toBe("20260303");
		expect(formatDateAsAbapDatetime(BASE_LOCAL_DATE)).toBe("20260303180350");
		expect(formatDateAsODataDate(BASE_LOCAL_DATE)).toBe("2026-03-03");
		expect(formatDateAsODataDatetime(BASE_LOCAL_DATE)).toBe("2026-03-03T18:03:50");
		expect(formatDateAsODataTime(BASE_LOCAL_DATE)).toBe("PT18H03M50S");
		expect(formatDateAsODataTime("PT2H3M4S")).toBe("PT02H03M04S");
		expect(formatDateAsODataTime("invalid", { fallback: "н/д" })).toBe("н/д");
	});

	it("форматирует диапазон дат", () => {
		expect(formatDateRange("2026-03-03T18:03:50.327Z", "2026-03-04T05:20:00.000+03:00", "datetime")).toBe(
			"03.03.2026 18:03 - 04.03.2026 05:20"
		);
	});

	it("возвращает fallback для невалидного диапазона", () => {
		expect(formatDateRange("abc", BASE_ISO_ZONED, "datetime")).toBe("");
		expect(formatDateRange("abc", BASE_ISO_ZONED, "datetime", { fallback: "пусто" })).toBe("пусто");
	});
});

describe("точность форматирования календарной даты", () => {
	it("не выводит день при точности month", () => {
		expect(formatDate(BASE_LOCAL_DATE, "date-short", { precision: "month" })).toBe("03.2026");
		expect(formatDate(BASE_LOCAL_DATE, "date-long", { precision: "month" })).toBe("март 2026 г.");
		expect(formatDate(BASE_LOCAL_DATE, "datetime-medium", { precision: "month" })).toBe("март 2026 г.");
	});

	it("не выводит день и месяц при точности year", () => {
		expect(formatDate(BASE_LOCAL_DATE, "date-short", { precision: "year" })).toBe("2026");
		expect(formatDate(BASE_LOCAL_DATE, "date-long", { precision: "year" })).toBe("2026");
		expect(formatDate(BASE_LOCAL_DATE, "datetime-medium", { precision: "year" })).toBe("2026");
	});

	it("фильтрует ручные шаблоны по точности", () => {
		expect(
			formatDate(
				BASE_LOCAL_DATE,
				{
					name: "slash",
					pattern: "yyyy/MM/dd",
					locale: "ru-RU",
					invalidFallback: ""
				},
				{ precision: "month" }
			)
		).toBe("2026/03");
		expect(
			formatDate(
				BASE_LOCAL_DATE,
				{
					name: "dotted",
					pattern: "dd.MM.yyyy",
					locale: "ru-RU",
					invalidFallback: ""
				},
				{ precision: "year" }
			)
		).toBe("2026");
	});
});

describe("parseDateValue", () => {
	it("парсит ISO-строку без timezone в локальные календарные компоненты", () => {
		const parsed = parseDateValue(BASE_ISO_LOCAL);
		expect(parsed?.kind).toBe("date-time");
		expect(parsed && parsed.kind === "date-time" ? getCalendarSnapshot(parsed.date) : "").toBe("2026-03-03T18:03:50");
	});

	it("парсит ISO-строку c Z без timezone-сдвига", () => {
		const parsed = parseDateValue(BASE_ISO_ZONED);
		expect(parsed?.kind).toBe("date-time");
		expect(parsed && parsed.kind === "date-time" ? getCalendarSnapshot(parsed.date) : "").toBe("2026-03-03T18:03:50");
	});

	it("парсит OData datetimeoffset без timezone-сдвига", () => {
		const parsed = parseDateValue("datetimeoffset'2026-03-03T18:03:50.327Z'");
		expect(parsed?.kind).toBe("date-time");
		expect(parsed && parsed.kind === "date-time" ? getCalendarSnapshot(parsed.date) : "").toBe("2026-03-03T18:03:50");
	});

	it("сохраняет календарные компоненты для Date-объекта", () => {
		const parsed = parseDateValue(BASE_LOCAL_DATE);
		expect(parsed?.kind).toBe("date-time");
		expect(parsed && parsed.kind === "date-time" ? getCalendarSnapshot(parsed.date) : "").toBe("2026-03-03T18:03:50");
	});

	it("возвращает подробный результат для duration", () => {
		const parsed = parseDateValue("PT2H30M");
		expect(parsed?.kind).toBe("duration");
	});

	it("парсит дату по пользовательскому шаблону", () => {
		const parsed = parseDateByPattern("03/03/2026", "dd/MM/yyyy");
		expect(parsed?.kind).toBe("date-time");
		expect(parsed && parsed.kind === "date-time" ? getCalendarSnapshot(parsed.date) : "").toBe("2026-03-03T00:00:00");
	});

	it("парсит двузначный год по шаблону", () => {
		const parsed = parseDateByPattern("03-03-26", "dd-MM-yy");
		expect(parsed?.kind).toBe("date-time");
		expect(parsed && parsed.kind === "date-time" ? getCalendarSnapshot(parsed.date) : "").toBe("2026-03-03T00:00:00");
	});
});

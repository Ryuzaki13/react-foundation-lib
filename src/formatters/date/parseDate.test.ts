import { describe, expect, it } from "vitest";

import { parseDate, parseDateByFormat, parseDateByPattern, parseDateValue } from "./parseDate";

const BASE_UTC_TIMESTAMP_MS = Date.UTC(2026, 2, 3, 18, 3, 50, 327);
const BASE_UTC_TIMESTAMP_SECONDS = Math.floor(BASE_UTC_TIMESTAMP_MS / 1_000);
const BASE_UTC_TIMESTAMP_WITH_OFFSET_MS = Date.UTC(2026, 2, 3, 15, 3, 50, 327);

describe("parseDateValue", () => {
	it("возвращает null для пустых и неподдерживаемых рантайм-значений", () => {
		expect(parseDateValue(null)).toBeNull();
		expect(parseDateValue(undefined)).toBeNull();
		expect(parseDateValue("")).toBeNull();
		expect(parseDateValue("   ")).toBeNull();
		expect(parseDateValue("null")).toBeNull();
		expect(parseDateValue(" Undefined ")).toBeNull();
		expect(parseDateValue(true)).toBeNull();
		expect(parseDateValue({ value: "2026-03-03" })).toBeNull();
		expect(parseDateValue([])).toBeNull();
		expect(parseDateValue(Symbol("date"))).toBeNull();
	});

	it("клонирует валидный Date и помечает источник date-object", () => {
		const value = new Date(2026, 2, 3, 18, 3, 50, 327);
		const parsed = parseDateValue(value);

		expect(parsed).toEqual({
			kind: "date-time",
			source: "date-object",
			date: new Date(2026, 2, 3, 18, 3, 50, 327)
		});
		expect(parsed && parsed.kind === "date-time" ? parsed.date : null).not.toBe(value);
	});

	it("возвращает null для невалидного Date", () => {
		expect(parseDateValue(new Date(Number.NaN))).toBeNull();
	});

	it("парсит numeric timestamp в секундах", () => {
		expect(parseDateValue(BASE_UTC_TIMESTAMP_SECONDS)).toEqual({
			kind: "date-time",
			source: "timestamp",
			date: new Date(2026, 2, 3, 18, 3, 50, 0)
		});
	});

	it("парсит numeric timestamp в миллисекундах", () => {
		expect(parseDateValue(BASE_UTC_TIMESTAMP_MS)).toEqual({
			kind: "date-time",
			source: "timestamp",
			date: new Date(2026, 2, 3, 18, 3, 50, 327)
		});
	});

	it("возвращает null для невалидного числа", () => {
		expect(parseDateValue(Number.NaN)).toBeNull();
		expect(parseDateValue(Number.POSITIVE_INFINITY)).toBeNull();
		expect(parseDateValue(Number.NEGATIVE_INFINITY)).toBeNull();
	});

	it("парсит OData ticks без offset", () => {
		expect(parseDateValue(`/Date(${BASE_UTC_TIMESTAMP_MS})/`)).toEqual({
			kind: "date-time",
			source: "odata-ticks",
			date: new Date(2026, 2, 3, 18, 3, 50, 327)
		});
	});

	it("парсит OData ticks с offset и сохраняет сервисные календарные компоненты", () => {
		expect(parseDateValue(`/Date(${BASE_UTC_TIMESTAMP_WITH_OFFSET_MS}+0300)/`)).toEqual({
			kind: "date-time",
			source: "odata-ticks",
			date: new Date(2026, 2, 3, 18, 3, 50, 327)
		});
	});

	it("парсит OData literal и переопределяет source", () => {
		expect(parseDateValue("datetimeoffset' 2026-03-03T18:03:50.327Z '")).toEqual({
			kind: "date-time",
			source: "odata-literal",
			date: new Date(2026, 2, 3, 18, 3, 50, 327)
		});
	});

	it("парсит ISO local c миллисекундами и обрезает дробную часть до миллисекунд", () => {
		expect(parseDateValue("2026-03-03T18:03:50.327987654")).toEqual({
			kind: "date-time",
			source: "iso-local",
			date: new Date(2026, 2, 3, 18, 3, 50, 327)
		});
	});

	it("парсит ISO zoned без пересчета видимых компонентов", () => {
		expect(parseDateValue("2026-03-03T18:03:50.327+05:30")).toEqual({
			kind: "date-time",
			source: "iso-zoned",
			date: new Date(2026, 2, 3, 18, 3, 50, 327)
		});
	});

	it("парсит ABAP compact, dotted и slash форматы", () => {
		expect(parseDateValue("20260303")).toEqual({
			kind: "date-time",
			source: "abap-compact",
			date: new Date(2026, 2, 3, 0, 0, 0, 0)
		});
		expect(parseDateValue("03.03.2026")).toEqual({
			kind: "date-time",
			source: "abap-dotted",
			date: new Date(2026, 2, 3, 0, 0, 0, 0)
		});
		expect(parseDateValue("03/03/2026")).toEqual({
			kind: "date-time",
			source: "slash-date",
			date: new Date(2026, 2, 3, 0, 0, 0, 0)
		});
	});

	it("парсит ABAP timestamp и игнорирует хвост после секунд", () => {
		expect(parseDateValue("20260501071545000007000")).toEqual({
			kind: "date-time",
			source: "abap-timestamp",
			date: new Date(2026, 4, 1, 7, 15, 45)
		});
		expect(parseDate("20260501071545000007000")).toEqual(new Date(2026, 4, 1, 7, 15, 45));
		expect(parseDate("20260501")).toEqual(new Date(2026, 4, 1));
	});

	it("парсит строковый integer timestamp", () => {
		expect(parseDateValue(String(BASE_UTC_TIMESTAMP_SECONDS))).toEqual({
			kind: "date-time",
			source: "timestamp",
			date: new Date(2026, 2, 3, 18, 3, 50, 0)
		});
	});

	it("парсит ISO-8601 duration, включая знак и дробные секунды", () => {
		expect(parseDateValue("PT2H30M")).toEqual({
			kind: "duration",
			source: "iso-duration",
			durationMs: 9_000_000
		});
		expect(parseDateValue("PT02H30M00S")).toEqual({
			kind: "duration",
			source: "iso-duration",
			durationMs: 9_000_000
		});
		expect(parseDateValue("-PT0.5S")).toEqual({
			kind: "duration",
			source: "iso-duration",
			durationMs: -500
		});
	});

	it("возвращает null для невалидных строк даты и duration", () => {
		expect(parseDateValue("/Date(foo)/")).toBeNull();
		expect(parseDateValue("datetime'not-a-date'")).toBeNull();
		expect(parseDateValue("2026-02-30")).toBeNull();
		expect(parseDateValue("20260230071545000007000")).toBeNull();
		expect(parseDateValue("2026-03-03T24:00:00")).toBeNull();
		expect(parseDateValue("13/40/2026")).toBeNull();
		expect(parseDateValue("P0D")).toBeNull();
		expect(parseDateValue("P")).toBeNull();
		expect(parseDateValue("abc")).toBeNull();
	});
});

describe("parseDate", () => {
	it("возвращает Date для обычной даты", () => {
		expect(parseDate("2026-03-03T18:03:50.327Z")).toEqual(new Date(2026, 2, 3, 18, 3, 50, 327));
	});

	it("преобразует duration в Date без timezone-сдвига", () => {
		expect(parseDate("PT2H30M")).toEqual(new Date(1970, 0, 1, 2, 30, 0, 0));
	});

	it("преобразует full-duration в Date без timezone-сдвига", () => {
		expect(parseDate("PT02H30M00S")).toEqual(new Date(1970, 0, 1, 2, 30, 0, 0));
	});

	it("возвращает null для невалидного значения", () => {
		expect(parseDate("abc")).toBeNull();
	});
});

describe("parseDateByPattern", () => {
	it("парсит дату по пользовательскому шаблону", () => {
		expect(parseDateByPattern("03/03/2026", "dd/MM/yyyy")).toEqual({
			kind: "date-time",
			source: "iso-local",
			date: new Date(2026, 2, 3, 0, 0, 0, 0)
		});
	});

	it("парсит дату со временем по строгому шаблону", () => {
		expect(parseDateByPattern("03.03.2026 18:03", "dd.MM.yyyy HH:mm")).toEqual({
			kind: "date-time",
			source: "iso-local",
			date: new Date(2026, 2, 3, 18, 3, 0, 0)
		});
	});

	it("поддерживает двухзначный год по pivot-правилу", () => {
		expect(parseDateByPattern("03-03-69", "dd-MM-yy")).toEqual({
			kind: "date-time",
			source: "iso-local",
			date: new Date(2069, 2, 3, 0, 0, 0, 0)
		});
		expect(parseDateByPattern("03-03-70", "dd-MM-yy")).toEqual({
			kind: "date-time",
			source: "iso-local",
			date: new Date(1970, 2, 3, 0, 0, 0, 0)
		});
	});

	it("экранирует спецсимволы в литералах шаблона", () => {
		expect(parseDateByPattern("03+03+2026", "dd+MM+yyyy")).toEqual({
			kind: "date-time",
			source: "iso-local",
			date: new Date(2026, 2, 3, 0, 0, 0, 0)
		});
	});

	it("делегирует нестроковые значения в parseDateValue", () => {
		expect(parseDateByPattern(BASE_UTC_TIMESTAMP_SECONDS)).toEqual({
			kind: "date-time",
			source: "timestamp",
			date: new Date(2026, 2, 3, 18, 3, 50, 0)
		});
	});

	it("игнорирует пустые строковые значения", () => {
		expect(parseDateByPattern("   ")).toBeNull();
		expect(parseDateByPattern("null")).toBeNull();
		expect(parseDateByPattern("Undefined")).toBeNull();
	});

	it("возвращает null для шаблона без обязательных токенов или при невалидной дате", () => {
		expect(parseDateByPattern("03.2026", "MM.yyyy")).toBeNull();
		expect(parseDateByPattern("03.03.2026", "literal-only")).toBeNull();
		expect(parseDateByPattern("31.02.2026", "dd.MM.yyyy")).toBeNull();
		expect(parseDateByPattern("03.03.2026 24:00", "dd.MM.yyyy HH:mm")).toBeNull();
		expect(parseDateByPattern("29.02.2025 10:00", "dd.MM.yyyy HH:mm")).toBeNull();
		expect(parseDateByPattern("03.03.2026", "yyyy/MM/dd")).toBeNull();
	});
});

describe("parseDateByFormat", () => {
	it("парсит дату по style-алиасу и имени Intl-пресета", () => {
		expect(parseDateByFormat("3 мар. 2026 г.", "medium")).toEqual({
			kind: "date-time",
			source: "iso-local",
			date: new Date(2026, 2, 3, 0, 0, 0, 0)
		});
		expect(parseDateByFormat("3 марта 2026 г.", "date-long")).toEqual({
			kind: "date-time",
			source: "iso-local",
			date: new Date(2026, 2, 3, 0, 0, 0, 0)
		});
	});

	it("парсит day+month пресеты с опорным годом", () => {
		expect(parseDateByFormat("25 мая", "month-long", { referenceDate: new Date(2026, 0, 1) })).toEqual({
			kind: "date-time",
			source: "iso-local",
			date: new Date(2026, 4, 25, 0, 0, 0, 0)
		});
		expect(parseDateByFormat("25 июн.", "month-short", { referenceDate: new Date(2026, 0, 1) })).toEqual({
			kind: "date-time",
			source: "iso-local",
			date: new Date(2026, 5, 25, 0, 0, 0, 0)
		});
	});

	it("парсит дату и время по Intl-пресету", () => {
		expect(parseDateByFormat("3 мар. 2026 г., 18:03:50", "datetime-medium")).toEqual({
			kind: "date-time",
			source: "iso-local",
			date: new Date(2026, 2, 3, 18, 3, 50, 0)
		});
	});

	it("сохраняет поддержку ручных шаблонов", () => {
		expect(parseDateByFormat("2026/03/03", "yyyy/MM/dd")).toEqual({
			kind: "date-time",
			source: "iso-local",
			date: new Date(2026, 2, 3, 0, 0, 0, 0)
		});
	});

	it("учитывает точность месяца при парсинге шаблонов и Intl-строк", () => {
		expect(parseDateByFormat("03.2026", "dd.MM.yyyy", { precision: "month" })).toEqual({
			kind: "date-time",
			source: "iso-local",
			date: new Date(2026, 2, 1, 0, 0, 0, 0)
		});
		expect(parseDateByFormat("март 2026 г.", "date-long", { precision: "month" })).toEqual({
			kind: "date-time",
			source: "iso-local",
			date: new Date(2026, 2, 1, 0, 0, 0, 0)
		});
	});

	it("учитывает точность года при парсинге шаблонов и Intl-строк", () => {
		expect(parseDateByFormat("2026", "dd.MM.yyyy", { precision: "year" })).toEqual({
			kind: "date-time",
			source: "iso-local",
			date: new Date(2026, 0, 1, 0, 0, 0, 0)
		});
		expect(parseDateByFormat("2026 г.", "long", { precision: "year" })).toEqual({
			kind: "date-time",
			source: "iso-local",
			date: new Date(2026, 0, 1, 0, 0, 0, 0)
		});
	});
});

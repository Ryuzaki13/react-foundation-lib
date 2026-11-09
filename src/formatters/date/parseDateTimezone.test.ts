import { describe, expect, it } from "vitest";

import { parseDate, parseDateTZ, parseDateValueTZ } from "./parseDate";

const BASE_INSTANT_MS = Date.UTC(2026, 2, 3, 15, 3, 50, 327);

describe("parseDateValueTZ", () => {
	it.each([
		["09.11.2024T03:00:00+03:00", "2024-11-09T00:00:00.000Z"],
		["09.11.2024T01:00:00+03:00", "2024-11-08T22:00:00.000Z"],
		["09.11.2024T23:00:00-04:30", "2024-11-10T03:30:00.000Z"],
		["09.11.2024T03:00:00.123456789+0330", "2024-11-08T23:30:00.123Z"],
		["09.11.2024T03:00:00Z", "2024-11-09T03:00:00.000Z"]
	])("применяет смещение даты с точками и временем: %s", (value, expectedInstant) => {
		expect(parseDateValueTZ(value)).toEqual({
			kind: "date-time",
			source: "abap-dotted",
			date: new Date(expectedInstant)
		});
	});

	it.each(["09.11.2024T03:00:00", "09.11.2024 03:00:00"])(
		"сохраняет календарные компоненты даты с точками и временем без смещения: %s",
		(value) => {
			expect(parseDateValueTZ(value)).toEqual({
				kind: "date-time",
				source: "abap-dotted",
				date: new Date(2024, 10, 9, 3)
			});
		}
	);

	it.each(["09.11.2024T03:00:00+24:00", "09.11.2024T03:00:00+03:60", "31.11.2024T03:00:00+03:00"])(
		"отклоняет невалидную дату с точками или смещение: %s",
		(value) => {
			expect(parseDateValueTZ(value)).toBeNull();
		}
	);

	it("применяет положительный и отрицательный ISO timezone offset", () => {
		expect(parseDateValueTZ("2026-03-03T18:03:50.327+05:30")).toEqual({
			kind: "date-time",
			source: "iso-zoned",
			date: new Date("2026-03-03T12:33:50.327Z")
		});
		expect(parseDateValueTZ("2026-03-03T18:03:50.327-04:00")).toEqual({
			kind: "date-time",
			source: "iso-zoned",
			date: new Date("2026-03-03T22:03:50.327Z")
		});
		expect(parseDateValueTZ("2026-03-03T18:03:50.327+0530")).toEqual({
			kind: "date-time",
			source: "iso-zoned",
			date: new Date("2026-03-03T12:33:50.327Z")
		});
	});

	it("сохраняет UTC instant для ISO Z", () => {
		expect(parseDateValueTZ("2026-03-03T18:03:50.327Z")).toEqual({
			kind: "date-time",
			source: "iso-zoned",
			date: new Date("2026-03-03T18:03:50.327Z")
		});
	});

	it("сохраняет ticks как OData instant и не применяет offset повторно", () => {
		expect(parseDateValueTZ(`/Date(${BASE_INSTANT_MS}+0300)/`)).toEqual({
			kind: "date-time",
			source: "odata-ticks",
			date: new Date(BASE_INSTANT_MS)
		});
		expect(parseDateValueTZ("/Date(1234567890+0200)/")).toEqual({
			kind: "date-time",
			source: "odata-ticks",
			date: new Date(1_234_567_890)
		});
	});

	it("применяет timezone внутри OData datetimeoffset literal", () => {
		expect(parseDateValueTZ("datetimeoffset' 2026-03-03T18:03:50.327+05:30 '")).toEqual({
			kind: "date-time",
			source: "odata-literal",
			date: new Date("2026-03-03T12:33:50.327Z")
		});
	});

	it("сохраняет instant числового timestamp и Date", () => {
		const instantSeconds = Math.floor(BASE_INSTANT_MS / 1_000);
		expect(parseDateValueTZ(instantSeconds)).toEqual({
			kind: "date-time",
			source: "timestamp",
			date: new Date(instantSeconds * 1_000)
		});
		expect(parseDateValueTZ(BASE_INSTANT_MS)).toEqual({
			kind: "date-time",
			source: "timestamp",
			date: new Date(BASE_INSTANT_MS)
		});
		expect(parseDateValueTZ(String(BASE_INSTANT_MS))).toEqual({
			kind: "date-time",
			source: "timestamp",
			date: new Date(BASE_INSTANT_MS)
		});

		const sourceDate = new Date(BASE_INSTANT_MS);
		const parsedDate = parseDateValueTZ(sourceDate);
		expect(parsedDate).toEqual({
			kind: "date-time",
			source: "date-object",
			date: sourceDate
		});
		expect(parsedDate && parsedDate.kind === "date-time" ? parsedDate.date : null).not.toBe(sourceDate);
	});

	it("оставляет форматы без timezone в календарной семантике", () => {
		expect(parseDateValueTZ("2026-03-03T18:03:50.327")).toEqual({
			kind: "date-time",
			source: "iso-local",
			date: new Date(2026, 2, 3, 18, 3, 50, 327)
		});
		expect(parseDateValueTZ("03.03.2026")).toEqual({
			kind: "date-time",
			source: "abap-dotted",
			date: new Date(2026, 2, 3)
		});
	});

	it("сохраняет duration как отдельный тип без timezone-семантики", () => {
		expect(parseDateValueTZ("PT2H30M")).toEqual({
			kind: "duration",
			source: "iso-duration",
			durationMs: 9_000_000
		});
	});

	it("отклоняет невалидный timezone", () => {
		expect(parseDateValueTZ("2026-03-03T18:03:50+24:00")).toBeNull();
		expect(parseDateValueTZ("2026-03-03T18:03:50+05:60")).toBeNull();
	});
});

describe("parseDateTZ", () => {
	it("применяет смещение даты с точками только при явном выборе TZ-разбора", () => {
		const value = "09.11.2024T03:00:00+03:00";

		expect(parseDate(value)).toEqual(new Date(2024, 10, 9, 3));
		expect(parseDateTZ(value)?.toISOString()).toBe("2024-11-09T00:00:00.000Z");
	});

	it("возвращает Date с абсолютным моментом времени", () => {
		expect(parseDateTZ("2026-03-03T18:03:50.327+05:30")).toEqual(new Date("2026-03-03T12:33:50.327Z"));
		expect(parseDateTZ(`/Date(${BASE_INSTANT_MS}+0300)/`)).toEqual(new Date(BASE_INSTANT_MS));
	});

	it("не меняет историческую семантику parseDate", () => {
		expect(parseDate(`/Date(${BASE_INSTANT_MS}+0300)/`)).toEqual(new Date(2026, 2, 3, 18, 3, 50, 327));
		expect(parseDate("2026-03-03T18:03:50.327+05:30")).toEqual(new Date(2026, 2, 3, 18, 3, 50, 327));
	});

	it("сохраняет прежнее преобразование duration в календарный Date", () => {
		expect(parseDateTZ("PT2H30M")).toEqual(new Date(1970, 0, 1, 2, 30));
	});
});

import { describe, expect, it } from "vitest";

import { areAllDateSegmentsEmpty, dateToIndexedSegmentValues, indexedSegmentsToDate, parseDateSegmentMask } from "./mask";

describe("parseDateSegmentMask", () => {
	it("разбирает фиксированную маску даты-времени в редактируемые и литеральные сегменты", () => {
		expect(parseDateSegmentMask("dd.MM.yyyy HH:mm")).toMatchObject([
			{ kind: "editable", id: "day", token: "dd" },
			{ kind: "literal", text: "." },
			{ kind: "editable", id: "month", token: "MM" },
			{ kind: "literal", text: "." },
			{ kind: "editable", id: "year", token: "yyyy" },
			{ kind: "literal", text: " " },
			{ kind: "editable", id: "hours", token: "HH" },
			{ kind: "literal", text: ":" },
			{ kind: "editable", id: "minutes", token: "mm" }
		]);
	});
});

describe("dateToIndexedSegmentValues", () => {
	it("формирует индексированную карту значений для Date", () => {
		const segments = parseDateSegmentMask("dd.MM.yyyy HH:mm");
		const values = dateToIndexedSegmentValues(new Date(2026, 2, 3, 18, 3, 0, 0), segments);

		expect(Array.from(values.entries())).toEqual([
			[0, "03"],
			[2, "03"],
			[4, "2026"],
			[6, "18"],
			[8, "03"]
		]);
	});

	it("возвращает пустые строки для пустого значения", () => {
		const segments = parseDateSegmentMask("dd.MM.yyyy HH:mm");
		const values = dateToIndexedSegmentValues(null, segments);

		expect(Array.from(values.values())).toEqual(["", "", "", "", ""]);
		expect(areAllDateSegmentsEmpty(segments, values)).toBe(true);
	});
});

describe("indexedSegmentsToDate", () => {
	it("собирает строгий Date из заполненных сегментов", () => {
		const segments = parseDateSegmentMask("dd.MM.yyyy HH:mm");
		const values = new Map<number, string>([
			[0, "03"],
			[2, "03"],
			[4, "2026"],
			[6, "18"],
			[8, "03"]
		]);

		expect(indexedSegmentsToDate(segments, values)).toEqual(new Date(2026, 2, 3, 18, 3, 0, 0));
	});

	it("отклоняет невалидные календарные даты и время", () => {
		const segments = parseDateSegmentMask("dd.MM.yyyy HH:mm");

		expect(
			indexedSegmentsToDate(
				segments,
				new Map<number, string>([
					[0, "31"],
					[2, "02"],
					[4, "2026"],
					[6, "10"],
					[8, "00"]
				])
			)
		).toBeNull();

		expect(
			indexedSegmentsToDate(
				segments,
				new Map<number, string>([
					[0, "03"],
					[2, "03"],
					[4, "2026"],
					[6, "24"],
					[8, "00"]
				])
			)
		).toBeNull();
	});

	it("использует defaultDate для масок без даты", () => {
		const segments = parseDateSegmentMask("HH:mm");
		const values = new Map<number, string>([
			[0, "09"],
			[2, "15"]
		]);

		expect(indexedSegmentsToDate(segments, values, { defaultDate: new Date(2026, 2, 3, 18, 3, 0, 0) })).toEqual(
			new Date(2026, 2, 3, 9, 15, 0, 0)
		);
	});
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildExcelAutoFilterRef, buildExcelSheetData, downloadExcelFile, downloadExcelWorkbook, resolveExcelSheetNames } from "./excel";

const toFileMock = vi.hoisted(() => vi.fn());
const writeXlsxFileMock = vi.hoisted(() =>
	vi.fn(() => ({
		toFile: toFileMock
	}))
);

vi.mock("write-excel-file/browser", () => ({
	default: writeXlsxFileMock
}));

describe("shared/lib/excel", () => {
	beforeEach(() => {
		writeXlsxFileMock.mockClear();
		toFileMock.mockReset();
		toFileMock.mockResolvedValue(undefined);
	});

	it("формирует header с жирным шрифтом и нижней серой рамкой", () => {
		const sheetData = buildExcelSheetData({
			columns: [{ id: "AMOUNT", header: "Сумма", type: Number, format: "#,##0.0" }],
			rows: [{ AMOUNT: 123.4 }]
		});

		expect(sheetData[0]?.[0]).toMatchObject({
			type: String,
			value: "Сумма",
			fontWeight: "bold",
			bottomBorderStyle: "thin",
			bottomBorderColor: "#D9D9D9"
		});
		expect(sheetData[1]?.[0]).toMatchObject({
			type: Number,
			value: 123.4,
			format: "#,##0.0"
		});
	});

	it("считает диапазон autoFilter", () => {
		expect(buildExcelAutoFilterRef(1, 2)).toBe("A1:A2");
		expect(buildExcelAutoFilterRef(28, 10)).toBe("A1:AB10");
	});

	it("нормализует ограничения и конфликты имён листов", () => {
		expect(resolveExcelSheetNames(["Продажи/Россия", "продажи россия", "", "Очень длинное название отчёта за период 2026"])).toEqual([
			"Продажи Россия",
			"продажи россия (2)",
			"Лист 3",
			"Очень длинное название отчёта з"
		]);
	});

	it("преобразует строковые OData-даты для Date-колонок", () => {
		const sheetData = buildExcelSheetData({
			columns: [{ id: "CREATED_AT", header: "Дата", type: Date, format: "dd.mm.yyyy" }],
			rows: [{ CREATED_AT: "datetime'2026-03-03T18:03:50'" }]
		});

		expect(sheetData[1]?.[0]).toMatchObject({
			type: Date,
			format: "dd.mm.yyyy"
		});

		const dateCell = sheetData[1]?.[0];
		if (!dateCell || typeof dateCell !== "object" || !("value" in dateCell)) {
			throw new Error("Ожидалась объектная ячейка даты");
		}

		expect(dateCell.value).toBeInstanceOf(Date);
	});

	it("передает autoFilter feature в write-excel-file", async () => {
		await downloadExcelFile({
			fileName: "export.xlsx",
			autoFilter: true,
			columns: [
				{ id: "A", header: "A" },
				{ id: "B", header: "B" }
			],
			rows: [{ A: "1", B: "2" }]
		});

		const options = (writeXlsxFileMock.mock.calls[0] as unknown[] | undefined)?.[1] as
			| {
					features?: Array<{
						files?: {
							transform?: Record<string, { transform?: (content: string, options: unknown, properties: unknown) => string }>;
						};
					}>;
			  }
			| undefined;
		const transform = options?.features?.[0]?.files?.transform?.["xl/worksheets/sheet{id}.xml"]?.transform;

		expect(typeof transform).toBe("function");
		expect(transform?.("<worksheet><sheetData></sheetData></worksheet>", {}, { sheetIndex: 0, sheetId: "1" })).toContain(
			'<autoFilter ref="A1:B2"/>'
		);
		expect(toFileMock).toHaveBeenCalledWith("export.xlsx");
	});

	it("формирует отдельные листы и диапазоны autoFilter одной книги", async () => {
		await downloadExcelWorkbook({
			fileName: "charts.xlsx",
			sheets: [
				{
					name: "График/1",
					columns: [{ id: "DATE", header: "Дата" }],
					rows: [{ DATE: "2026-01-01" }],
					autoFilter: true
				},
				{
					name: "График 2",
					columns: [
						{ id: "DATE", header: "Дата" },
						{ id: "VALUE", header: "Значение", type: Number }
					],
					rows: [
						{ DATE: "2026-01-01", VALUE: 10 },
						{ DATE: "2026-01-02", VALUE: 20 }
					],
					autoFilter: true
				}
			]
		});

		const sheets = (writeXlsxFileMock.mock.calls[0] as unknown[] | undefined)?.[0] as
			Array<{ sheet?: string; data?: unknown[]; columns?: Array<{ width?: number }> }> | undefined;
		expect(sheets?.map((sheet) => sheet.sheet)).toEqual(["График 1", "График 2"]);
		expect(sheets?.map((sheet) => sheet.data?.length)).toEqual([2, 3]);

		const options = (writeXlsxFileMock.mock.calls[0] as unknown[] | undefined)?.[1] as
			| {
					features?: Array<{
						files?: {
							transform?: Record<
								string,
								{ transform?: (content: string, options: unknown, properties: { sheetIndex: number }) => string }
							>;
						};
					}>;
			  }
			| undefined;
		const transform = options?.features?.[0]?.files?.transform?.["xl/worksheets/sheet{id}.xml"]?.transform;
		const content = "<worksheet><sheetData></sheetData></worksheet>";

		expect(transform?.(content, {}, { sheetIndex: 0 })).toContain('<autoFilter ref="A1:A2"/>');
		expect(transform?.(content, {}, { sheetIndex: 1 })).toContain('<autoFilter ref="A1:B3"/>');
		expect(toFileMock).toHaveBeenCalledWith("charts.xlsx");
	});
});

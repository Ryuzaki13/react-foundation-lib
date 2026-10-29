import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { registerNumberPreset, resetNumberPresets } from "../formatters/number";

import { buildExcelSheetData, downloadExcelFile, downloadExcelWorkbook } from "./excel";
import {
	createTableExcelColumn,
	downloadResolvedExcelTable,
	downloadResolvedExcelWorkbook,
	type TableExcelColumnDescriptor
} from "./tableExport";

vi.mock("./excel", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./excel")>();

	return {
		...actual,
		downloadExcelFile: vi.fn(),
		downloadExcelWorkbook: vi.fn()
	};
});

const mockedDownloadExcelFile = vi.mocked(downloadExcelFile);
const mockedDownloadExcelWorkbook = vi.mocked(downloadExcelWorkbook);

beforeEach(() => {
	mockedDownloadExcelFile.mockReset();
	mockedDownloadExcelWorkbook.mockReset();
});

afterEach(resetNumberPresets);

describe("shared/lib/excel/tableExport", () => {
	it("выводит тип колонки из OData-типа, роли и clientOnly-флага", () => {
		expect(createTableExcelColumn({ id: "LOCAL", header: "Локальная", clientOnly: true })).toMatchObject({
			type: Number,
			format: "#,##0.0"
		});
		expect(createTableExcelColumn({ id: "FLAG", header: "Флаг", odataType: "boolean" })).toMatchObject({
			type: Boolean,
			format: undefined
		});
		expect(createTableExcelColumn({ id: "MEASURE", header: "Показатель", role: "measure" })).toMatchObject({
			type: Number,
			format: "#,##0.0"
		});
		expect(createTableExcelColumn({ id: "TEXT", header: "Текст" })).toMatchObject({
			type: String,
			format: undefined
		});
	});

	it("подбирает числовой формат для integer и настроенного number preset", () => {
		expect(createTableExcelColumn({ id: "COUNT", header: "Количество", odataType: "int" })).toMatchObject({
			type: Number,
			format: "#,##0"
		});
		expect(
			createTableExcelColumn({
				id: "PERCENT",
				header: "Процент",
				odataType: "decimal",
				formattersPipeline: {
					version: 1,
					plan: {
						steps: [
							{
								id: "typed",
								type: "typedValueFormat",
								config: { numberPresetName: " percent " }
							}
						]
					}
				}
			})
		).toMatchObject({
			type: Number,
			format: "#,##0.00"
		});
	});

	it("передаёт долю в Excel числом без изменения frozen pipeline и строк", () => {
		const descriptor = {
			id: "SHARE",
			header: "Доля",
			odataType: "decimal",
			formattersPipeline: {
				version: 1,
				plan: {
					steps: [
						{
							id: "typed",
							type: "typedValueFormat",
							config: { numberPresetName: "ratio-percent" }
						}
					]
				}
			}
		} satisfies TableExcelColumnDescriptor;
		const step = descriptor.formattersPipeline.plan.steps[0];
		Object.freeze(step.config);
		Object.freeze(step);
		Object.freeze(descriptor.formattersPipeline.plan.steps);
		Object.freeze(descriptor.formattersPipeline.plan);
		Object.freeze(descriptor.formattersPipeline);
		Object.freeze(descriptor);
		const rows = [Object.freeze({ SHARE: 0.2 })];
		Object.freeze(rows);
		const column = Object.freeze(createTableExcelColumn(descriptor));
		const columns = [column];
		Object.freeze(columns);

		const data = buildExcelSheetData({ columns, rows });

		expect(column).toMatchObject({ type: Number, format: "#,##0.00%" });
		expect(data[1]?.[0]).toMatchObject({ value: 0.2, type: Number, format: "#,##0.00%" });
		expect(rows).toEqual([{ SHARE: 0.2 }]);
		expect(step.config).toEqual({ numberPresetName: "ratio-percent" });
	});

	it.each([
		{ name: "whole-share", decimals: 0, expectedFormat: "#,##0%" },
		{ name: "precise-share", decimals: 3, expectedFormat: "#,##0.000%" }
	])("выводит процентную маску custom preset $name по style и точности", ({ name, decimals, expectedFormat }) => {
		registerNumberPreset({ name, decimals, style: "percent" });

		const column = createTableExcelColumn({
			id: "SHARE",
			header: "Доля",
			odataType: "decimal",
			formattersPipeline: {
				version: 1,
				plan: { steps: [{ id: "typed", type: "typedValueFormat", config: { numberPresetName: name } }] }
			}
		});

		expect(column).toMatchObject({ type: Number, format: expectedFormat });
	});

	it("не выводит процентную маску только по имени ratio-percent", () => {
		registerNumberPreset({ name: "ratio-percent", decimals: 3, style: "decimal" });

		const column = createTableExcelColumn({
			id: "SHARE",
			header: "Доля",
			odataType: "decimal",
			formattersPipeline: {
				version: 1,
				plan: { steps: [{ id: "typed", type: "typedValueFormat", config: { numberPresetName: "ratio-percent" } }] }
			}
		});

		expect(column).toMatchObject({ type: Number, format: "#,##0.000" });
	});

	it("повторно проверяет несовместимость percent и compact при чтении изменённого preset", () => {
		const preset = registerNumberPreset({ name: "mutated-share", style: "percent" });
		// Registry возвращает mutable public preset, поэтому ранее валидный объект
		// мог измениться до создания Excel-колонки.
		preset.compact = {};

		expect(() =>
			createTableExcelColumn({
				id: "SHARE",
				header: "Доля",
				odataType: "decimal",
				formattersPipeline: {
					version: 1,
					plan: { steps: [{ id: "typed", type: "typedValueFormat", config: { numberPresetName: preset.name } }] }
				}
			})
		).toThrow();
	});

	it("применяет числовой preset только для Number-колонки", () => {
		const dateColumn = createTableExcelColumn({
			id: "CREATED_AT",
			header: "Дата",
			odataType: "datetime",
			formattersPipeline: {
				version: 1,
				plan: {
					steps: [
						{
							id: "typed",
							type: "typedValueFormat",
							config: {
								numberPresetName: "percent",
								datePresetName: "date"
							}
						}
					]
				}
			}
		});

		expect(dateColumn).toMatchObject({
			id: "CREATED_AT",
			type: Date,
			format: "dd.mm.yyyy"
		});
	});

	it("для Number-колонки игнорирует date preset и использует числовой формат", () => {
		const numberColumn = createTableExcelColumn({
			id: "AMOUNT",
			header: "Сумма",
			odataType: "decimal",
			formattersPipeline: {
				version: 1,
				plan: {
					steps: [
						{
							id: "typed",
							type: "typedValueFormat",
							config: {
								datePresetName: "datetime"
							}
						}
					]
				}
			}
		});

		expect(numberColumn).toMatchObject({
			id: "AMOUNT",
			type: Number,
			format: "#,##0.0"
		});
	});

	it("поддерживает ручной date pattern из typedValueFormat", () => {
		const column = createTableExcelColumn({
			id: "ABAP_DATE",
			header: "Дата SAP",
			odataType: "datetime",
			formattersPipeline: {
				version: 1,
				plan: {
					steps: [
						{
							id: "typed",
							type: "typedValueFormat",
							config: {
								datePresetName: "yyyyMMdd"
							}
						}
					]
				}
			}
		});

		expect(column).toMatchObject({
			type: Date,
			format: "yyyymmdd"
		});
	});

	it.each([
		["month-short", "dd.mm"],
		["month-medium", "d mmm"],
		["month-long", "d mmmm"]
	])("поддерживает day+month date preset %s из typedValueFormat", (datePresetName, expectedFormat) => {
		const column = createTableExcelColumn({
			id: "BIRTHDAY",
			header: "Дата",
			odataType: "datetime",
			formattersPipeline: {
				version: 1,
				plan: {
					steps: [
						{
							id: "typed",
							type: "typedValueFormat",
							config: {
								datePresetName
							}
						}
					]
				}
			}
		});

		expect(column).toMatchObject({
			type: Date,
			format: expectedFormat
		});
	});

	it.each([
		["month-year-medium", "mmm yyyy"],
		["month-year-long", "mmmm yyyy"]
	])("поддерживает month+year date preset %s из typedValueFormat", (datePresetName, expectedFormat) => {
		const column = createTableExcelColumn({
			id: "PERIOD",
			header: "Период",
			odataType: "datetime",
			formattersPipeline: {
				version: 1,
				plan: {
					steps: [
						{
							id: "typed",
							type: "typedValueFormat",
							config: {
								datePresetName
							}
						}
					]
				}
			}
		});

		expect(column).toMatchObject({
			type: Date,
			format: expectedFormat
		});
	});

	it("использует встроенные Excel-форматы для time и datetimeOffset", () => {
		expect(createTableExcelColumn({ id: "TIME", header: "Время", odataType: "time" })).toMatchObject({
			type: Date,
			format: "hh:mm"
		});
		expect(createTableExcelColumn({ id: "DATE_TIME", header: "Дата", odataType: "datetimeOffset" })).toMatchObject({
			type: Date,
			format: "dd.mm.yyyy hh:mm"
		});
	});

	it("пробрасывает таблицу и стили ячеек в downloadExcelFile", async () => {
		const columns = [{ id: "AMOUNT", header: "Сумма", type: Number, format: "#,##0.0" }];
		const rows = [{ AMOUNT: 10 }, { AMOUNT: 20 }];
		const cellStyles = [{ AMOUNT: { textColor: "#107C10" } }, { AMOUNT: { textColor: "#C50F1F" } }];

		await downloadResolvedExcelTable({
			fileName: "report.xlsx",
			autoFilter: false,
			table: { columns, rows, cellStyles }
		});

		expect(mockedDownloadExcelFile).toHaveBeenCalledWith(
			expect.objectContaining({
				fileName: "report.xlsx",
				columns,
				rows,
				autoFilter: false
			})
		);
		const args = mockedDownloadExcelFile.mock.calls[0]?.[0];

		expect(args?.getCellStyle?.({ row: rows[1], column: columns[0], rowIndex: 1, columnIndex: 0 })).toEqual({ textColor: "#C50F1F" });
	});

	it("пробрасывает несколько подготовленных таблиц в workbook writer", async () => {
		const firstTable = {
			columns: [{ id: "DATE", header: "Дата", type: Date }],
			rows: [{ DATE: "2026-01-01" }]
		};
		const secondTable = {
			columns: [{ id: "VALUE", header: "Значение", type: Number }],
			rows: [{ VALUE: 10 }],
			cellStyles: [{ VALUE: { textColor: "#107C10" } }]
		};

		await downloadResolvedExcelWorkbook({
			fileName: "charts.xlsx",
			sheets: [
				{ name: "Первый", table: firstTable },
				{ name: "Второй", table: secondTable, autoFilter: false }
			]
		});

		expect(mockedDownloadExcelWorkbook).toHaveBeenCalledWith(
			expect.objectContaining({
				fileName: "charts.xlsx",
				sheets: [
					expect.objectContaining({ name: "Первый", columns: firstTable.columns, rows: firstTable.rows, autoFilter: true }),
					expect.objectContaining({ name: "Второй", columns: secondTable.columns, rows: secondTable.rows, autoFilter: false })
				]
			})
		);

		const secondSheet = mockedDownloadExcelWorkbook.mock.calls[0]?.[0].sheets[1];
		expect(
			secondSheet?.getCellStyle?.({
				row: secondTable.rows[0],
				column: secondTable.columns[0],
				rowIndex: 0,
				columnIndex: 0
			})
		).toEqual({ textColor: "#107C10" });
	});
});

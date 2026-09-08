import { beforeEach, describe, expect, it, vi } from "vitest";

import { createExcelMatrixWorkbookBlob } from "./matrixWorkbook";

const toBlobMock = vi.hoisted(() => vi.fn());
const writeXlsxFileMock = vi.hoisted(() =>
	vi.fn(() => ({
		toBlob: toBlobMock
	}))
);

vi.mock("write-excel-file/browser", () => ({
	default: writeXlsxFileMock
}));

describe("матричная Excel-книга", () => {
	beforeEach(() => {
		writeXlsxFileMock.mockClear();
		toBlobMock.mockReset();
		toBlobMock.mockResolvedValue(new Blob(["xlsx"]));
	});

	it("формирует Blob и передаёт произвольную матрицу без табличного header", async () => {
		const blob = await createExcelMatrixWorkbookBlob({
			sheets: [
				{
					name: "Расписание/неделя",
					rows: [[{ value: "Заголовок", type: String, columnSpan: 2 }, null]],
					columns: [{ width: 5 }, { width: 10 }],
					showGridLines: false
				}
			]
		});

		expect(blob).toBeInstanceOf(Blob);
		expect(writeXlsxFileMock).toHaveBeenCalledWith(
			[
				{
					data: [[{ value: "Заголовок", type: String, columnSpan: 2 }, null]],
					sheet: "Расписание неделя",
					columns: [{ width: 5 }, { width: 10 }],
					showGridLines: false,
					zoomScale: undefined
				}
			],
			{ features: undefined }
		);
	});

	it("добавляет print area, повтор заголовков и разрывы между колонками", async () => {
		await createExcelMatrixWorkbookBlob({
			sheets: [
				{
					name: "Неделя",
					rows: [["Заголовок"]],
					print: {
						orientation: "portrait",
						paperSize: "a4",
						fitToWidthPages: 0,
						fitToHeightPages: 1,
						pageOrder: "overThenDown",
						repeatRows: [1, 6],
						repeatColumns: [1, 2],
						printArea: { firstRow: 1, lastRow: 114, firstColumn: 1, lastColumn: 154 },
						columnBreaksAfter: [38, 74],
						footer: { left: "Отчёт abc", includePageNumber: true }
					}
				}
			]
		});

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
		const feature = options?.features?.[0]?.files?.transform;
		const sheetXml = feature?.["xl/worksheets/sheet{id}.xml"]?.transform?.(
			'<worksheet><sheetViews/><sheetData></sheetData><mergeCells count="0"></mergeCells></worksheet>',
			{},
			{ sheetIndex: 0 }
		);
		const workbookXml = feature?.["xl/workbook.xml"]?.transform?.(
			"<workbook><sheets></sheets><definedNames/><calcPr/></workbook>",
			{},
			{ sheetIndex: 0 }
		);

		expect(sheetXml).toContain('<pageSetUpPr fitToPage="1" autoPageBreaks="0"/>');
		expect(sheetXml).toContain('orientation="portrait"');
		expect(sheetXml).toContain('fitToWidth="0"');
		expect(sheetXml).toContain('fitToHeight="1"');
		expect(sheetXml).toContain('<brk id="38"');
		expect(sheetXml).toContain("Отчёт abc");
		expect(workbookXml).toContain("_xlnm.Print_Titles");
		expect(workbookXml).toContain("$1:$6");
		expect(workbookXml).toContain("$A:$B");
		expect(workbookXml).toContain("_xlnm.Print_Area");
		expect(workbookXml).toContain("$A$1:$EX$114");
		expect(workbookXml?.match(/<definedNames(?=[\s/>])/g)).toHaveLength(1);
		expect(workbookXml).toContain("</definedNames><calcPr/>");
	});

	it("отклоняет zero-based и обратные печатные диапазоны", async () => {
		await expect(
			createExcelMatrixWorkbookBlob({
				sheets: [
					{
						name: "Неделя",
						rows: [["Заголовок"]],
						print: { orientation: "portrait", repeatColumns: [0, 2] }
					}
				]
			})
		).rejects.toThrow("положительным целым числом");
	});
});

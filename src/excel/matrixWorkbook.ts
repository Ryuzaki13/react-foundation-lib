import writeXlsxFile, { type Cell, type Feature, type Sheet } from "write-excel-file/browser";

import { downloadFileFromBlob } from "../dom";
import { escapeXmlValue } from "../xml";

import { resolveExcelSheetNames } from "./excel";

type BrowserExcelFileContent = File | Blob | ArrayBuffer;

/** Одна строка произвольной Excel-матрицы. Объединения задаются стилями первой ячейки диапазона. */
export type ExcelMatrixRow = readonly Cell[];

/** Поля задаются в дюймах, как в OpenXML и диалоге параметров страницы Excel. */
export type ExcelPrintMargins = {
	readonly left: number;
	readonly right: number;
	readonly top: number;
	readonly bottom: number;
	readonly header: number;
	readonly footer: number;
};

/** Видимый колонтитул не принимает raw Excel-коды, чтобы текст не мог случайно изменить разметку секций. */
export type ExcelPrintHeaderFooter = {
	readonly left?: string;
	readonly center?: string;
	readonly right?: string;
	readonly includePageNumber?: boolean;
};

/** One-based прямоугольник печати соответствует координатам строк и столбцов Excel. */
export type ExcelPrintArea = {
	readonly firstRow: number;
	readonly lastRow: number;
	readonly firstColumn: number;
	readonly lastColumn: number;
};

/**
 * Печатный контракт одного листа.
 *
 * `columnBreaksAfter` и `rowBreaksAfter` используют one-based координату
 * последней ячейки страницы. Явная модель не позволяет consumer перепутать
 * индекс массива с адресом Excel и разрезать составной блок на печати.
 */
export type ExcelPrintSetup = {
	readonly orientation: "portrait" | "landscape";
	readonly paperSize?: "a4" | "a3";
	readonly fitToWidthPages?: number;
	readonly fitToHeightPages?: number;
	readonly pageOrder?: "downThenOver" | "overThenDown";
	readonly margins?: ExcelPrintMargins;
	readonly repeatRows?: readonly [firstRow: number, lastRow: number];
	readonly repeatColumns?: readonly [firstColumn: number, lastColumn: number];
	readonly printArea?: ExcelPrintArea;
	readonly columnBreaksAfter?: readonly number[];
	readonly rowBreaksAfter?: readonly number[];
	readonly header?: ExcelPrintHeaderFooter;
	readonly footer?: ExcelPrintHeaderFooter;
};

/** Произвольный лист сохраняет готовую матрицу и не навязывает табличную строку заголовков. */
export type ExcelMatrixWorkbookSheet = {
	readonly name: string;
	readonly rows: readonly ExcelMatrixRow[];
	readonly columns?: readonly { readonly width?: number }[];
	readonly showGridLines?: boolean;
	readonly zoomScale?: number;
	readonly print?: ExcelPrintSetup;
};

/** Аргументы generic-книги, пригодной как для скачивания, так и для file validation. */
export type ExcelMatrixWorkbookArgs = {
	readonly sheets: readonly ExcelMatrixWorkbookSheet[];
};

const DEFAULT_PRINT_MARGINS = {
	left: 0.2,
	right: 0.2,
	top: 0.25,
	bottom: 0.25,
	header: 0.1,
	footer: 0.1
} as const satisfies ExcelPrintMargins;

const PAPER_SIZE = { a4: 9, a3: 8 } as const;

function escapeHeaderFooterText(value: string): string {
	return escapeXmlValue(value.replaceAll("&", "&&"));
}

function numberToColumnName(index: number): string {
	let value = index;
	let result = "";
	while (value > 0) {
		const remainder = (value - 1) % 26;
		result = String.fromCharCode(65 + remainder) + result;
		value = Math.floor((value - 1) / 26);
	}
	return result;
}

function assertPositiveInteger(value: number, name: string): void {
	if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} должен быть положительным целым числом`);
}

function assertNonnegativeInteger(value: number, name: string): void {
	if (!Number.isInteger(value) || value < 0) throw new Error(`${name} должен быть целым неотрицательным числом`);
}

function validateRange(range: readonly [number, number], name: string): void {
	assertPositiveInteger(range[0], `${name}: начало`);
	assertPositiveInteger(range[1], `${name}: конец`);
	if (range[0] > range[1]) throw new Error(`${name}: начало не может быть больше конца`);
}

function validatePrintSetup(print: ExcelPrintSetup): void {
	// В OpenXML ноль означает автоматическое число страниц по соответствующей оси.
	if (print.fitToWidthPages !== undefined) assertNonnegativeInteger(print.fitToWidthPages, "fitToWidthPages");
	if (print.fitToHeightPages !== undefined) assertNonnegativeInteger(print.fitToHeightPages, "fitToHeightPages");
	if (print.repeatRows) validateRange(print.repeatRows, "repeatRows");
	if (print.repeatColumns) validateRange(print.repeatColumns, "repeatColumns");
	for (const value of print.columnBreaksAfter ?? []) assertPositiveInteger(value, "columnBreaksAfter");
	for (const value of print.rowBreaksAfter ?? []) assertPositiveInteger(value, "rowBreaksAfter");
	if (print.printArea) {
		assertPositiveInteger(print.printArea.firstRow, "printArea.firstRow");
		assertPositiveInteger(print.printArea.lastRow, "printArea.lastRow");
		assertPositiveInteger(print.printArea.firstColumn, "printArea.firstColumn");
		assertPositiveInteger(print.printArea.lastColumn, "printArea.lastColumn");
		if (print.printArea.firstRow > print.printArea.lastRow || print.printArea.firstColumn > print.printArea.lastColumn) {
			throw new Error("printArea должен задавать непустой прямоугольник");
		}
	}
}

function buildHeaderFooterXml(
	tagName: "headerFooter",
	header: ExcelPrintHeaderFooter | undefined,
	footer: ExcelPrintHeaderFooter | undefined
): string {
	if (!header && !footer) return "";
	const buildSection = (value: ExcelPrintHeaderFooter | undefined) => {
		if (!value) return "";
		const content = [
			value.left ? `&amp;L${escapeHeaderFooterText(value.left)}` : "",
			value.center ? `&amp;C${escapeHeaderFooterText(value.center)}` : "",
			value.right ? `&amp;R${escapeHeaderFooterText(value.right)}` : "",
			value.includePageNumber ? "&amp;RСтраница &amp;P из &amp;N" : ""
		].join("");
		return content;
	};
	const oddHeader = buildSection(header);
	const oddFooter = buildSection(footer);
	return `<${tagName}>${oddHeader ? `<oddHeader>${oddHeader}</oddHeader>` : ""}${oddFooter ? `<oddFooter>${oddFooter}</oddFooter>` : ""}</${tagName}>`;
}

function buildBreaksXml(tagName: "colBreaks" | "rowBreaks", values: readonly number[] | undefined): string {
	if (!values || values.length === 0) return "";
	const uniqueValues = [...new Set(values)].sort((left, right) => left - right);
	return `<${tagName} count="${uniqueValues.length}" manualBreakCount="${uniqueValues.length}">${uniqueValues
		.map((value) => `<brk id="${value}" min="0" max="16383" man="1"/>`)
		.join("")}</${tagName}>`;
}

function applyWorksheetPrintSetup(content: string, print: ExcelPrintSetup): string {
	const margins = print.margins ?? DEFAULT_PRINT_MARGINS;
	const fitToPage = print.fitToWidthPages !== undefined || print.fitToHeightPages !== undefined;
	const sheetProperties = fitToPage ? '<sheetPr><pageSetUpPr fitToPage="1" autoPageBreaks="0"/></sheetPr>' : "";
	const result = sheetProperties ? content.replace("<sheetViews", `${sheetProperties}<sheetViews`) : content;
	const pageMargins = `<pageMargins left="${margins.left}" right="${margins.right}" top="${margins.top}" bottom="${margins.bottom}" header="${margins.header}" footer="${margins.footer}"/>`;
	const pageSetupAttributes = [
		`paperSize="${PAPER_SIZE[print.paperSize ?? "a4"]}"`,
		`orientation="${print.orientation}"`,
		print.fitToWidthPages !== undefined ? `fitToWidth="${print.fitToWidthPages}"` : "",
		print.fitToHeightPages !== undefined ? `fitToHeight="${print.fitToHeightPages}"` : "",
		print.pageOrder ? `pageOrder="${print.pageOrder}"` : "",
		'usePrinterDefaults="0"'
	]
		.filter(Boolean)
		.join(" ");
	const additions = [
		pageMargins,
		`<pageSetup ${pageSetupAttributes}/>`,
		buildHeaderFooterXml("headerFooter", print.header, print.footer),
		buildBreaksXml("rowBreaks", print.rowBreaksAfter),
		buildBreaksXml("colBreaks", print.columnBreaksAfter)
	].join("");
	const drawingIndex = result.indexOf("<drawing");
	return drawingIndex >= 0
		? `${result.slice(0, drawingIndex)}${additions}${result.slice(drawingIndex)}`
		: result.replace("</worksheet>", `${additions}</worksheet>`);
}

function quoteFormulaSheetName(name: string): string {
	return `'${name.replaceAll("'", "''")}'`;
}

function buildDefinedNames(sheetNames: readonly string[], sheets: readonly ExcelMatrixWorkbookSheet[]): string {
	const definitions: string[] = [];
	for (let sheetIndex = 0; sheetIndex < sheets.length; sheetIndex += 1) {
		const print = sheets[sheetIndex]?.print;
		if (!print) continue;
		const sheetName = quoteFormulaSheetName(sheetNames[sheetIndex] ?? `Лист ${sheetIndex + 1}`);
		const titles = [
			print.repeatRows ? `${sheetName}!$${print.repeatRows[0]}:$${print.repeatRows[1]}` : "",
			print.repeatColumns
				? `${sheetName}!$${numberToColumnName(print.repeatColumns[0])}:$${numberToColumnName(print.repeatColumns[1])}`
				: ""
		]
			.filter(Boolean)
			.join(",");
		if (titles) {
			definitions.push(`<definedName name="_xlnm.Print_Titles" localSheetId="${sheetIndex}">${escapeXmlValue(titles)}</definedName>`);
		}
		if (print.printArea) {
			const { firstRow, lastRow, firstColumn, lastColumn } = print.printArea;
			const area = `${sheetName}!$${numberToColumnName(firstColumn)}$${firstRow}:$${numberToColumnName(lastColumn)}$${lastRow}`;
			definitions.push(`<definedName name="_xlnm.Print_Area" localSheetId="${sheetIndex}">${escapeXmlValue(area)}</definedName>`);
		}
	}
	return definitions.join("");
}

/**
 * Дополняет штатный контейнер definedNames, который write-excel-file уже
 * создаёт в workbook.xml. Два одноимённых контейнера формально нарушают схему
 * OOXML: Numbers читает такую книгу, а Microsoft Excel отклоняет её.
 */
function applyWorkbookDefinedNames(content: string, definedNames: string): string {
	if (/<definedNames\s*\/>/.test(content)) {
		return content.replace(/<definedNames\s*\/>/, `<definedNames>${definedNames}</definedNames>`);
	}
	if (content.includes("</definedNames>")) {
		return content.replace("</definedNames>", `${definedNames}</definedNames>`);
	}
	return content.replace("</sheets>", `</sheets><definedNames>${definedNames}</definedNames>`);
}

/** Настройки печати требуют двух согласованных OpenXML-частей: worksheet и workbook defined names. */
function createMatrixPrintFeature(
	sheetNames: readonly string[],
	sheets: readonly ExcelMatrixWorkbookSheet[]
): Feature<BrowserExcelFileContent> | undefined {
	if (!sheets.some(({ print }) => print)) return undefined;
	const definedNames = buildDefinedNames(sheetNames, sheets);
	return {
		files: {
			transform: {
				"xl/worksheets/sheet{id}.xml": {
					transform: (content, _options, properties) => {
						const setup = sheets[properties.sheetIndex]?.print;
						return setup ? applyWorksheetPrintSetup(content, setup) : content;
					}
				},
				"xl/workbook.xml": {
					transform: (content) => (definedNames ? applyWorkbookDefinedNames(content, definedNames) : content)
				}
			}
		}
	};
}

/**
 * Формирует Blob без побочного эффекта скачивания.
 *
 * Этот вход нужен предпросмотру, file validation и сценариям, где download
 * выполняет отдельный browser-owner. KTK-specific layout сюда не передаётся.
 */
export async function createExcelMatrixWorkbookBlob(args: ExcelMatrixWorkbookArgs): Promise<Blob> {
	if (args.sheets.length === 0) throw new Error("Для формирования Excel-книги нужен минимум один лист");
	for (const sheet of args.sheets) {
		if (sheet.rows.length === 0) throw new Error(`Лист «${sheet.name}» не содержит строк`);
		if (sheet.print) validatePrintSetup(sheet.print);
	}

	const sheetNames = resolveExcelSheetNames(args.sheets.map(({ name }) => name));
	const sheets: Sheet<BrowserExcelFileContent>[] = args.sheets.map((sheet, index) => ({
		data: sheet.rows.map((row) => [...row]),
		sheet: sheetNames[index],
		columns: sheet.columns?.map((column) => ({ width: column.width })),
		showGridLines: sheet.showGridLines,
		zoomScale: sheet.zoomScale
	}));
	const printFeature = createMatrixPrintFeature(sheetNames, args.sheets);
	return writeXlsxFile(sheets, { features: printFeature ? [printFeature] : undefined }).toBlob();
}

/** Скачивает готовую матричную книгу из явного пользовательского действия. */
export async function downloadExcelMatrixWorkbook(fileName: string, args: ExcelMatrixWorkbookArgs): Promise<void> {
	const blob = await createExcelMatrixWorkbookBlob(args);
	downloadFileFromBlob(fileName, blob);
}

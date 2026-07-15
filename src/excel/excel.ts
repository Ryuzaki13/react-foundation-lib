import writeXlsxFile, { type Cell, type CellObject, type Feature, type Sheet, type SheetData } from "write-excel-file/browser";

import { parseDate } from "../formatters/date";
import { type State } from "../types";

export type ExcelColumn = {
	id: string;
	header: string;
	width?: number;
	type?: StringConstructor | NumberConstructor | DateConstructor | BooleanConstructor;
	format?: string;
};

export type ExcelRow = Record<string, unknown>;

export type ExcelCellStyle = Omit<CellObject, "value" | "type" | "format">;

export type DownloadExcelFileArgs = {
	fileName: string;
	columns: ExcelColumn[];
	rows: ExcelRow[];
	autoFilter?: boolean;
	getCellStyle?: (args: { row: ExcelRow; column: ExcelColumn; rowIndex: number; columnIndex: number }) => ExcelCellStyle | undefined;
};

/** Описание одного табличного листа внутри Excel-книги. */
export type ExcelWorkbookSheet = Omit<DownloadExcelFileArgs, "fileName"> & {
	/** Желаемое имя листа; writer нормализует ограничения формата и конфликты имён. */
	name: string;
};

/** Аргументы формирования Excel-книги с одним или несколькими табличными листами. */
export type DownloadExcelWorkbookArgs = {
	/** Имя скачиваемого `.xlsx` файла. */
	fileName: string;
	/** Листы книги в порядке отображения в Excel. */
	sheets: ExcelWorkbookSheet[];
};

type BrowserExcelFileContent = File | Blob | ArrayBuffer;

const VALUE_STATE_TEXT_COLORS: Partial<Record<State, string>> = {
	information: "#2563EB",
	success: "#107C10",
	warning: "#B7791F",
	error: "#C50F1F"
};

const HEADER_CELL_STYLE = {
	fontWeight: "bold",
	bottomBorderStyle: "thin",
	bottomBorderColor: "#D9D9D9"
} satisfies ExcelCellStyle;

const EXCEL_SHEET_NAME_MAX_LENGTH = 31;
const EXCEL_SHEET_NAME_INVALID_CHARACTERS = /[\u0000-\u001f[\]/\\:*?]+/g;
const EXCEL_SHEET_NAME_EDGE_APOSTROPHES = /^'+|'+$/g;
const EXCEL_SHEET_NAME_WHITESPACE = /\s+/g;

/**
 * Приводит общий value-state проекта к базовому Excel-стилю.
 *
 * Helper живет в shared Excel-слое, чтобы analytical/detail экспорт не
 * дублировали палитру статусов и одинаково подсвечивали warning/error/success.
 */
export function resolveExcelCellStyleFromState(state: State | undefined): ExcelCellStyle | undefined {
	const textColor = state ? VALUE_STATE_TEXT_COLORS[state] : undefined;
	return textColor ? { textColor } : undefined;
}

/**
 * Переводит zero-based индекс колонки в Excel-адрес (`0 -> A`, `27 -> AB`).
 * Нужен для XML-диапазонов, потому что `write-excel-file` не предоставляет
 * отдельного API для построения ссылок вида `A1:C10`.
 */
function numberToColumnName(index: number): string {
	let value = index + 1;
	let out = "";

	while (value > 0) {
		const remainder = (value - 1) % 26;
		out = String.fromCharCode(65 + remainder) + out;
		value = Math.floor((value - 1) / 26);
	}

	return out;
}

/**
 * Строит диапазон автофильтра для всей выгруженной таблицы.
 *
 * Возвращает `undefined` для пустой сетки, чтобы не вставлять в xlsx
 * невалидный `<autoFilter>` без реального диапазона.
 */
export function buildExcelAutoFilterRef(columnCount: number, rowCount: number): string | undefined {
	if (columnCount <= 0 || rowCount <= 0) return undefined;

	return `A1:${numberToColumnName(columnCount - 1)}${rowCount}`;
}

/**
 * Добавляет autoFilter через feature-transform `write-excel-file`.
 *
 * Библиотека умеет трансформировать XML листа, но не имеет высокоуровневого
 * параметра `autoFilter`, поэтому здесь изолирован низкоуровневый OpenXML-хук.
 */
function createAutoFilterFeature<FileContent>(refs: readonly (string | undefined)[]): Feature<FileContent> | undefined {
	if (!refs.some(Boolean)) return undefined;

	return {
		files: {
			transform: {
				"xl/worksheets/sheet{id}.xml": {
					transform: (content, _options, properties) => {
						const ref = refs[properties.sheetIndex];
						return ref ? content.replace("</sheetData>", `</sheetData><autoFilter ref="${ref}"/>`) : content;
					}
				}
			}
		}
	};
}

/**
 * Нормализует имена листов по ограничениям Excel и делает их уникальными.
 *
 * Runtime-заголовки могут содержать запрещённые символы, превышать 31 знак или
 * совпадать между несколькими представлениями одной конфигурации. Нормализация
 * выполняется централизованно, чтобы все consumers получали открываемую книгу.
 */
export function resolveExcelSheetNames(names: readonly string[]): string[] {
	const usedNames = new Set<string>();
	const resolvedNames: string[] = [];

	for (let index = 0; index < names.length; index += 1) {
		const fallbackName = `Лист ${index + 1}`;
		const normalizedName = names[index]
			?.replace(EXCEL_SHEET_NAME_INVALID_CHARACTERS, " ")
			.replace(EXCEL_SHEET_NAME_WHITESPACE, " ")
			.trim()
			.replace(EXCEL_SHEET_NAME_EDGE_APOSTROPHES, "")
			.trim();
		const baseName = normalizedName || fallbackName;
		let resolvedName = baseName.slice(0, EXCEL_SHEET_NAME_MAX_LENGTH);
		let duplicateIndex = 2;

		while (usedNames.has(resolvedName.toLocaleLowerCase())) {
			const suffix = ` (${duplicateIndex})`;
			resolvedName = `${baseName.slice(0, EXCEL_SHEET_NAME_MAX_LENGTH - suffix.length)}${suffix}`;
			duplicateIndex += 1;
		}

		usedNames.add(resolvedName.toLocaleLowerCase());
		resolvedNames.push(resolvedName);
	}

	return resolvedNames;
}

/**
 * Приводит входное значение к типу Excel-ячейки.
 *
 * Важный смысл: если колонка числовая, в файл должен попасть настоящий Number,
 * а не уже отформатированная строка. Тогда Excel сможет применять `format`.
 */
function normalizeCellValue(value: unknown, type: ExcelColumn["type"]) {
	if (value == null || value === "") return undefined;

	if (type === Number) {
		const numberValue = typeof value === "number" ? value : Number(value);
		return Number.isFinite(numberValue) ? numberValue : undefined;
	}

	if (type === String) return String(value);
	if (type === Boolean) return Boolean(value);
	if (type === Date) return value instanceof Date ? value : (parseDate(value) ?? undefined);

	return value as CellObject["value"];
}

/**
 * Собирает SheetData для `write-excel-file`.
 *
 * Функция намеренно не знает о бизнес-сущностях: ей передают уже готовые
 * колонки/строки и необязательный callback стилей конкретных ячеек.
 */
export function buildExcelSheetData(args: Omit<DownloadExcelFileArgs, "fileName" | "autoFilter">): SheetData {
	const headerRow: Cell[] = args.columns.map((column) => ({
		type: String,
		value: column.header,
		...HEADER_CELL_STYLE
	}));

	const sheetRows: SheetData = [headerRow];

	for (let rowIndex = 0; rowIndex < args.rows.length; rowIndex++) {
		const row = args.rows[rowIndex];
		const sheetRow: Cell[] = [];

		for (let columnIndex = 0; columnIndex < args.columns.length; columnIndex++) {
			const column = args.columns[columnIndex];
			const value = normalizeCellValue(row[column.id], column.type);
			const style = args.getCellStyle?.({ row, column, rowIndex, columnIndex });

			sheetRow.push({
				value,
				type: column.type,
				format: column.format,
				...style
			});
		}

		sheetRows.push(sheetRow);
	}

	return sheetRows;
}

/**
 * Формирует и скачивает Excel-книгу с независимыми табличными листами.
 *
 * Каждый лист получает собственные ширины колонок, стили ячеек и диапазон
 * автофильтра. Доменная подготовка колонок и строк остаётся у вызывающей стороны.
 */
export async function downloadExcelWorkbook(args: DownloadExcelWorkbookArgs): Promise<void> {
	if (args.sheets.length === 0) {
		throw new Error("Для формирования Excel-книги нужен минимум один лист");
	}

	const sheetNames = resolveExcelSheetNames(args.sheets.map((sheet) => sheet.name));
	const autoFilterRefs: Array<string | undefined> = [];
	const sheets: Sheet<BrowserExcelFileContent>[] = args.sheets.map((sheet, index) => {
		const data = buildExcelSheetData(sheet);
		autoFilterRefs.push(sheet.autoFilter ? buildExcelAutoFilterRef(sheet.columns.length, data.length) : undefined);

		return {
			data,
			sheet: sheetNames[index],
			columns: sheet.columns.map((column) => ({
				width: column.width
			}))
		};
	});
	const autoFilterFeature = createAutoFilterFeature<BrowserExcelFileContent>(autoFilterRefs);

	await writeXlsxFile(sheets, {
		features: autoFilterFeature ? [autoFilterFeature] : undefined
	}).toFile(args.fileName);
}

/**
 * Формирует и скачивает `.xlsx` в браузере.
 *
 * Это публичная generic-точка shared-слоя: она отвечает только за Excel-файл,
 * а подготовка доменных данных остаётся на вызывающей стороне.
 */
export async function downloadExcelFile(args: DownloadExcelFileArgs): Promise<void> {
	await downloadExcelWorkbook({
		fileName: args.fileName,
		sheets: [
			{
				name: "Sheet1",
				columns: args.columns,
				rows: args.rows,
				autoFilter: args.autoFilter,
				getCellStyle: args.getCellStyle
			}
		]
	});
}

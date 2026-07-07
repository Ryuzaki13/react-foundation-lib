import writeXlsxFile, { type Cell, type CellObject, type Feature, type SheetData } from "write-excel-file/browser";

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
function createAutoFilterFeature<FileContent>(ref: string | undefined): Feature<FileContent> | undefined {
	if (!ref) return undefined;

	return {
		files: {
			transform: {
				"xl/worksheets/sheet{id}.xml": {
					transform: (content) => content.replace("</sheetData>", `</sheetData><autoFilter ref="${ref}"/>`)
				}
			}
		}
	};
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
 * Формирует и скачивает `.xlsx` в браузере.
 *
 * Это публичная generic-точка shared-слоя: она отвечает только за Excel-файл,
 * а подготовка доменных данных остаётся на вызывающей стороне.
 */
export async function downloadExcelFile(args: DownloadExcelFileArgs): Promise<void> {
	const sheetData = buildExcelSheetData(args);
	const autoFilterRef = args.autoFilter ? buildExcelAutoFilterRef(args.columns.length, sheetData.length) : undefined;
	const autoFilterFeature = createAutoFilterFeature<BrowserExcelFileContent>(autoFilterRef);

	await writeXlsxFile(
		sheetData,
		{
			columns: args.columns.map((column) => ({
				width: column.width
			}))
		},
		{
			features: autoFilterFeature ? [autoFilterFeature] : undefined
		}
	).toFile(args.fileName);
}

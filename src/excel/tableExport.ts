import { DEFAULT_DATE_PRESET_NAMES, getDatePreset, type DateFormatPreset } from "../formatters/date";
import { getNumberPreset } from "../formatters/number";
import { NUMBER_PRESET_NAME_DECIMAL, NUMBER_PRESET_NAME_INTEGER } from "../formatters/number/numberPresetNameConstants";
import {
	validateFormattersPipelineConfig,
	type FormattersPipelineConfig,
	type FormattersPipelineTypedValueFormatConfig
} from "../formatters/pipeline";
import { PIPELINE_FORMATTER_TYPED_VALUE_FORMAT } from "../formatters/pipeline/formattersPipelineConstants";
import { type ColumnRole, type ScalarMetaType } from "../metadata/metadataTypes";
import { isScalarBooleanType, isScalarDateType, isScalarIntegerType, isScalarNumericType } from "../metadata/scalarTypeClassification";
import { SCALAR_ROLE_MEASURE, SCALAR_TYPE_DATETIME, SCALAR_TYPE_DATETIME_OFFSET, SCALAR_TYPE_TIME } from "../metadata/scalarTypeConstants";

import { downloadExcelFile, downloadExcelWorkbook, type ExcelCellStyle, type ExcelColumn, type ExcelRow } from "./excel";

export type TableExcelColumnDescriptor = {
	id: string;
	header: string;
	width?: number;
	role?: ColumnRole;
	odataType?: ScalarMetaType;
	clientOnly?: boolean;
	formattersPipeline?: FormattersPipelineConfig;
};

export type ResolvedExcelTable = {
	columns: ExcelColumn[];
	rows: ExcelRow[];
	cellStyles?: ReadonlyArray<Readonly<Record<string, ExcelCellStyle | undefined>>>;
};

export type DownloadResolvedExcelTableArgs = {
	fileName: string;
	table: ResolvedExcelTable;
	autoFilter?: boolean;
};

/** Один подготовленный табличный лист generic Excel-книги. */
export type ResolvedExcelWorkbookSheet = {
	/** Желаемое имя листа. */
	name: string;
	/** Подготовленные колонки, строки и optional стили ячеек. */
	table: ResolvedExcelTable;
	/** Включить автофильтр для этого листа. По умолчанию включён. */
	autoFilter?: boolean;
};

/** Аргументы скачивания книги из нескольких подготовленных таблиц. */
export type DownloadResolvedExcelWorkbookArgs = {
	/** Имя скачиваемого `.xlsx` файла. */
	fileName: string;
	/** Табличные листы в порядке отображения в книге. */
	sheets: ResolvedExcelWorkbookSheet[];
};

const INTEGER_EXCEL_FORMAT = "#,##0";
const DEFAULT_DECIMAL_EXCEL_FORMAT = "#,##0.0";
// Prefix определяет семейство встроенного date preset, а не скалярный тип данных.
const DATE_PRESET_PREFIX_DATE = "date";
const DATE_PRESET_PREFIX_TIME = "time";
const DATE_PRESET_PREFIX_DATETIME = "datetime";
const EXCEL_DATE_FORMAT = "dd.mm.yyyy";
/**
 * Excel-маски календарных пресетов сохраняют экранную детализацию:
 * month-* выводит день и месяц без года, а month-year-* — месяц и год без дня.
 */
const EXCEL_DAY_MONTH_SHORT_FORMAT = "dd.mm";
const EXCEL_DAY_MONTH_MEDIUM_FORMAT = "d mmm";
const EXCEL_DAY_MONTH_LONG_FORMAT = "d mmmm";
const EXCEL_MONTH_YEAR_MEDIUM_FORMAT = "mmm yyyy";
const EXCEL_MONTH_YEAR_LONG_FORMAT = "mmmm yyyy";
const EXCEL_TIME_FORMAT = "hh:mm";
const EXCEL_TIME_SECONDS_FORMAT = "hh:mm:ss";
const EXCEL_DATETIME_FORMAT = `${EXCEL_DATE_FORMAT} ${EXCEL_TIME_FORMAT}`;
const EXCEL_DATETIME_SECONDS_FORMAT = `${EXCEL_DATE_FORMAT} ${EXCEL_TIME_SECONDS_FORMAT}`;

function resolveTypedValueFormatConfig(
	formattersPipeline: FormattersPipelineConfig | undefined
): FormattersPipelineTypedValueFormatConfig | undefined {
	const validation = validateFormattersPipelineConfig(formattersPipeline);
	const typedValueFormatStep = validation.plan?.steps.find((step) => step.type === PIPELINE_FORMATTER_TYPED_VALUE_FORMAT);

	return typedValueFormatStep?.type === PIPELINE_FORMATTER_TYPED_VALUE_FORMAT ? typedValueFormatStep.config : undefined;
}

export function resolveTableExcelColumnType(descriptor: TableExcelColumnDescriptor): ExcelColumn["type"] {
	if (descriptor.clientOnly) return Number;
	if (isScalarDateType(descriptor.odataType)) return Date;
	if (isScalarBooleanType(descriptor.odataType)) return Boolean;
	if (isScalarNumericType(descriptor.odataType)) return Number;
	if (descriptor.role === SCALAR_ROLE_MEASURE) return Number;
	return String;
}

function resolveNumberPresetName(descriptor: TableExcelColumnDescriptor): string {
	const configuredPresetName = resolveTypedValueFormatConfig(descriptor.formattersPipeline)?.numberPresetName?.trim();
	if (configuredPresetName && getNumberPreset(configuredPresetName)) return configuredPresetName;
	if (isScalarIntegerType(descriptor.odataType)) return NUMBER_PRESET_NAME_INTEGER;
	return NUMBER_PRESET_NAME_DECIMAL;
}

function resolveExcelNumberFormat(descriptor: TableExcelColumnDescriptor): string {
	const preset = getNumberPreset(resolveNumberPresetName(descriptor));
	if (!preset) return DEFAULT_DECIMAL_EXCEL_FORMAT;
	return preset.decimals > 0 ? `#,##0.${"0".repeat(preset.decimals)}` : INTEGER_EXCEL_FORMAT;
}

function resolveDatePresetName(descriptor: TableExcelColumnDescriptor): string {
	const configuredPresetName = resolveTypedValueFormatConfig(descriptor.formattersPipeline)?.datePresetName?.trim();
	if (configuredPresetName) return configuredPresetName;
	if (descriptor.odataType === SCALAR_TYPE_TIME) return DEFAULT_DATE_PRESET_NAMES.time;
	if (descriptor.odataType === SCALAR_TYPE_DATETIME || descriptor.odataType === SCALAR_TYPE_DATETIME_OFFSET)
		return DEFAULT_DATE_PRESET_NAMES.datetime;
	return DEFAULT_DATE_PRESET_NAMES.date;
}

function normalizeDatePatternForExcel(pattern: string): string {
	return pattern.replace(/H/g, "h").replace(/M/g, "m");
}

function resolveBuiltinDatePresetExcelFormat(presetName: string): string | undefined {
	if (presetName === DEFAULT_DATE_PRESET_NAMES.odataDatetime || presetName === DEFAULT_DATE_PRESET_NAMES.abapDatetime) {
		return EXCEL_DATETIME_SECONDS_FORMAT;
	}

	if (presetName === DEFAULT_DATE_PRESET_NAMES.odataDate || presetName === DEFAULT_DATE_PRESET_NAMES.abapDate) {
		return EXCEL_DATE_FORMAT;
	}

	if (presetName === DEFAULT_DATE_PRESET_NAMES.monthShort) {
		return EXCEL_DAY_MONTH_SHORT_FORMAT;
	}

	if (presetName === DEFAULT_DATE_PRESET_NAMES.monthMedium) {
		return EXCEL_DAY_MONTH_MEDIUM_FORMAT;
	}

	if (presetName === DEFAULT_DATE_PRESET_NAMES.monthLong) {
		return EXCEL_DAY_MONTH_LONG_FORMAT;
	}

	if (presetName === DEFAULT_DATE_PRESET_NAMES.monthYearMedium) {
		return EXCEL_MONTH_YEAR_MEDIUM_FORMAT;
	}

	if (presetName === DEFAULT_DATE_PRESET_NAMES.monthYearLong) {
		return EXCEL_MONTH_YEAR_LONG_FORMAT;
	}

	if (presetName.startsWith(DATE_PRESET_PREFIX_DATETIME)) {
		return presetName === DEFAULT_DATE_PRESET_NAMES.datetime || presetName === DEFAULT_DATE_PRESET_NAMES.datetimeShort
			? EXCEL_DATETIME_FORMAT
			: EXCEL_DATETIME_SECONDS_FORMAT;
	}

	if (presetName.startsWith(DATE_PRESET_PREFIX_TIME)) {
		return presetName === DEFAULT_DATE_PRESET_NAMES.time || presetName === DEFAULT_DATE_PRESET_NAMES.timeShort
			? EXCEL_TIME_FORMAT
			: EXCEL_TIME_SECONDS_FORMAT;
	}

	if (presetName.startsWith(DATE_PRESET_PREFIX_DATE)) return EXCEL_DATE_FORMAT;

	return undefined;
}

function resolveExcelDateFormatFromPreset(presetName: string, preset: DateFormatPreset | undefined): string {
	const builtinFormat = resolveBuiltinDatePresetExcelFormat(presetName);
	if (builtinFormat) return builtinFormat;
	if (preset?.pattern) return normalizeDatePatternForExcel(preset.pattern);

	// Настройка datePresetName исторически хранит и ручной шаблон. Если имени
	// нет в реестре, передаём шаблон в Excel как есть после нормализации токенов.
	return normalizeDatePatternForExcel(presetName);
}

function resolveExcelDateFormat(descriptor: TableExcelColumnDescriptor): string {
	const presetName = resolveDatePresetName(descriptor);
	return resolveExcelDateFormatFromPreset(presetName, getDatePreset(presetName));
}

function resolveTableExcelColumnFormat(descriptor: TableExcelColumnDescriptor, type: ExcelColumn["type"]): string | undefined {
	if (type === Number) return resolveExcelNumberFormat(descriptor);
	if (type === Date) return resolveExcelDateFormat(descriptor);
	return undefined;
}

export function createTableExcelColumn(descriptor: TableExcelColumnDescriptor): ExcelColumn {
	const type = resolveTableExcelColumnType(descriptor);
	return {
		id: descriptor.id,
		header: descriptor.header,
		width: descriptor.width,
		type,
		format: resolveTableExcelColumnFormat(descriptor, type)
	};
}

export async function downloadResolvedExcelTable({ fileName, table, autoFilter = true }: DownloadResolvedExcelTableArgs): Promise<void> {
	await downloadExcelFile({
		fileName,
		columns: table.columns,
		rows: table.rows,
		autoFilter,
		getCellStyle: ({ rowIndex, column }) => table.cellStyles?.[rowIndex]?.[column.id]
	});
}

/** Скачивает многолистовую книгу из таблиц, уже подготовленных доменными consumers. */
export async function downloadResolvedExcelWorkbook({ fileName, sheets }: DownloadResolvedExcelWorkbookArgs): Promise<void> {
	await downloadExcelWorkbook({
		fileName,
		sheets: sheets.map(({ name, table, autoFilter = true }) => ({
			name,
			columns: table.columns,
			rows: table.rows,
			autoFilter,
			getCellStyle: ({ rowIndex, column }) => table.cellStyles?.[rowIndex]?.[column.id]
		}))
	});
}

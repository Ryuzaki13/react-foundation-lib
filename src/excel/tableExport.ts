import { DEFAULT_DATE_PRESET_NAMES, getDatePreset, type DateFormatPreset } from "../formatters/date";
import { getNumberPreset } from "../formatters/number";
import {
	validateFormattersPipelineConfig,
	type FormattersPipelineConfig,
	type FormattersPipelineTypedValueFormatConfig
} from "../formatters/pipeline";
import {
	isODataBooleanType,
	isODataDateType,
	isODataIntegerType,
	isODataNumericType,
	type ColumnRole,
	type ODataMetaType
} from "../odata-service";

import { downloadExcelFile, type ExcelCellStyle, type ExcelColumn, type ExcelRow } from "./excel";

export type TableExcelColumnDescriptor = {
	id: string;
	header: string;
	width?: number;
	role?: ColumnRole;
	odataType?: ODataMetaType;
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

const INTEGER_EXCEL_FORMAT = "#,##0";
const DEFAULT_DECIMAL_EXCEL_FORMAT = "#,##0.0";
const EXCEL_DATE_FORMAT = "dd.mm.yyyy";
const EXCEL_DAY_MONTH_SHORT_FORMAT = "d mmm";
const EXCEL_DAY_MONTH_LONG_FORMAT = "d mmmm";
const EXCEL_TIME_FORMAT = "hh:mm";
const EXCEL_TIME_SECONDS_FORMAT = "hh:mm:ss";
const EXCEL_DATETIME_FORMAT = `${EXCEL_DATE_FORMAT} ${EXCEL_TIME_FORMAT}`;
const EXCEL_DATETIME_SECONDS_FORMAT = `${EXCEL_DATE_FORMAT} ${EXCEL_TIME_SECONDS_FORMAT}`;

function resolveTypedValueFormatConfig(
	formattersPipeline: FormattersPipelineConfig | undefined
): FormattersPipelineTypedValueFormatConfig | undefined {
	const validation = validateFormattersPipelineConfig(formattersPipeline);
	const typedValueFormatStep = validation.plan?.steps.find((step) => step.type === "typedValueFormat");

	return typedValueFormatStep?.type === "typedValueFormat" ? typedValueFormatStep.config : undefined;
}

export function resolveTableExcelColumnType(descriptor: TableExcelColumnDescriptor): ExcelColumn["type"] {
	if (descriptor.clientOnly) return Number;
	if (isODataDateType(descriptor.odataType)) return Date;
	if (isODataBooleanType(descriptor.odataType)) return Boolean;
	if (isODataNumericType(descriptor.odataType)) return Number;
	if (descriptor.role === "measure") return Number;
	return String;
}

function resolveNumberPresetName(descriptor: TableExcelColumnDescriptor): string {
	const configuredPresetName = resolveTypedValueFormatConfig(descriptor.formattersPipeline)?.numberPresetName?.trim();
	if (configuredPresetName && getNumberPreset(configuredPresetName)) return configuredPresetName;
	if (isODataIntegerType(descriptor.odataType)) return "integer";
	return "decimal";
}

function resolveExcelNumberFormat(descriptor: TableExcelColumnDescriptor): string {
	const preset = getNumberPreset(resolveNumberPresetName(descriptor));
	if (!preset) return DEFAULT_DECIMAL_EXCEL_FORMAT;
	return preset.decimals > 0 ? `#,##0.${"0".repeat(preset.decimals)}` : INTEGER_EXCEL_FORMAT;
}

function resolveDatePresetName(descriptor: TableExcelColumnDescriptor): string {
	const configuredPresetName = resolveTypedValueFormatConfig(descriptor.formattersPipeline)?.datePresetName?.trim();
	if (configuredPresetName) return configuredPresetName;
	if (descriptor.odataType === "time") return DEFAULT_DATE_PRESET_NAMES.time;
	if (descriptor.odataType === "datetime" || descriptor.odataType === "datetimeOffset") return DEFAULT_DATE_PRESET_NAMES.datetime;
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

	if (presetName === DEFAULT_DATE_PRESET_NAMES.monthLong) {
		return EXCEL_DAY_MONTH_LONG_FORMAT;
	}

	if (presetName.startsWith("datetime")) {
		return presetName === DEFAULT_DATE_PRESET_NAMES.datetime || presetName === DEFAULT_DATE_PRESET_NAMES.datetimeShort
			? EXCEL_DATETIME_FORMAT
			: EXCEL_DATETIME_SECONDS_FORMAT;
	}

	if (presetName.startsWith("time")) {
		return presetName === DEFAULT_DATE_PRESET_NAMES.time || presetName === DEFAULT_DATE_PRESET_NAMES.timeShort
			? EXCEL_TIME_FORMAT
			: EXCEL_TIME_SECONDS_FORMAT;
	}

	if (presetName.startsWith("date")) return EXCEL_DATE_FORMAT;

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

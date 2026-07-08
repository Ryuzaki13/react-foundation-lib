import { z } from "zod";

import { parseAbapBoolean } from "../formatters/boolean/parseAbapBoolean";
import { formatDateAsAbapDate } from "../formatters/date/formatDate";
import { parseDate } from "../formatters/date/parseDate";
import { parseNumber } from "../formatters/number/parseNumber";
import { ODataDateFormat } from "../odata/dateUtils";

import { odataTypeSchemas } from "./schema";

import type {
	BaseMetaType,
	EntityParameterProperty,
	ODataBooleanType,
	ODataDateType,
	ODataFormatterDescription,
	ODataMetaType,
	ODataNumericType,
	ODataStringType
} from "./types";

/**
 * NOTE: Запрещено экспортировать!
 */
function formatValidValue(type: ODataMetaType, validValue: unknown) {
	switch (type) {
		case "string":
			return `'${String(validValue).replace(/'/g, "''")}'`;
		case "guid":
			return `guid'${String(validValue)}'`;
		case "boolean":
			return validValue ? "'X'" : "' '";
		case "long":
			return `${String(validValue)}L`;
		case "float":
			return `${String(validValue)}F`;
		case "decimal":
			return `${String(validValue)}M`;
		case "double":
			return `${String(validValue)}D`;
		case "datetime":
		case "datetimeOffset":
		case "time":
			if (!(validValue instanceof Date)) {
				throw new Error(`Неверная дата для типа '${type}': ${validValue}`);
			}
			return ODataDateFormat[type](validValue);
		case "binary":
			return `binary'${validValue}'`;
		case "byte":
		case "int":
			return `${String(validValue)}`;

		default:
			throw new Error(`Неподдерживаемый тип: ${type satisfies never}`);
	}
}

/**
 * Форматирует значение для использования в URL в соответствии с типом OData
 * @param type Тип данных
 * @param value Значение
 * @returns Отформатированная строка
 */
export function odataFormatValue(type: ODataMetaType, value: unknown): string {
	const schema = odataTypeSchemas[type];
	const result = schema.safeParse(value);
	if (!result.success) {
		throw new Error(`Некорректное значение для типа '${type}': ${result.error.issues[0]?.message ?? value}`);
	}

	return formatValidValue(type, result.data);
}

type ODataMetadataValueDescriptor = Pick<EntityParameterProperty, "type" | "abapBooleanLike">;

function tryParseBooleanValue(value: unknown): boolean | undefined {
	if (typeof value === "boolean") return value;
	if (typeof value === "number") {
		if (value === 1) return true;
		if (value === 0) return false;
		return undefined;
	}
	if (typeof value !== "string") return undefined;

	if (value === "X") return true;
	if (value === " " || value === "") return false;

	const normalized = value.trim().toLowerCase();
	if (normalized === "true" || normalized === "1") return true;
	if (normalized === "false" || normalized === "0") return false;

	return undefined;
}

function tryParseAbapBooleanLikeValue(value: unknown): boolean | undefined {
	if (value == null) return false;
	if (typeof value !== "string") return undefined;
	if (value === "X" || value === " " || value === "") {
		return parseAbapBoolean(value);
	}
	return undefined;
}

export function odataParseValue(type: ODataBooleanType, value: unknown): boolean | unknown;
export function odataParseValue(type: ODataNumericType, value: unknown): number | unknown;
export function odataParseValue(type: ODataDateType, value: unknown): Date | null | unknown;
export function odataParseValue(type: ODataStringType, value: unknown): string | unknown;
export function odataParseValue(type: ODataMetaType, value: unknown): string | unknown;
export function odataParseValue(type: ODataMetaType, value: unknown) {
	switch (type) {
		case "boolean": {
			const parsed = tryParseBooleanValue(value);
			return parsed ?? value;
		}

		case "int":
		case "long":
		case "float":
		case "decimal":
		case "double":
		case "byte":
			return parseNumber(value);

		case "datetime":
		case "datetimeOffset":
		case "time":
			return parseDate(value);

		default:
			return String(value);
	}
}

export function odataParseValueByMetadata(descriptor: ODataMetadataValueDescriptor, value: unknown) {
	if (descriptor.abapBooleanLike) {
		const parsedBoolean = tryParseAbapBooleanLikeValue(value);
		if (parsedBoolean !== undefined) {
			return parsedBoolean;
		}
	}

	return odataParseValue(descriptor.type, value);
}

export function defaultODataTypeValue(type: ODataMetaType) {
	switch (type) {
		case "boolean":
			return false;

		case "int":
		case "long":
		case "float":
		case "decimal":
		case "double":
		case "byte":
			return 0;

		case "datetime":
		case "datetimeOffset":
		case "time":
			return new Date();

		default:
			return "";
	}
}

export function defaultControlTypeValue(type: BaseMetaType) {
	switch (type) {
		case "boolean":
			return false;
		case "number":
			return 0;
		case "date":
			return new Date();
		default:
			return "";
	}
}

export function createFormatter<S extends z.ZodArray>(schema: S, fn: (...args: [...z.infer<S>]) => string) {
	return (...args: unknown[]) => {
		const result = schema.safeParse(args);
		if (!result.success) {
			throw new Error(`Validation failed: ${result.error.message}`);
		}
		return fn(...result.data);
	};
}

export function createBooleanFormatter(fn: (...args: boolean[]) => string) {
	return createFormatter(z.array(z.boolean()), fn);
}

export function createStringFormatter(fn: (...args: string[]) => string) {
	return createFormatter(z.array(z.string()), fn);
}

export function createNumberFormatter(fn: (...args: number[]) => string) {
	return createFormatter(z.array(z.number()), fn);
}

export function createDateFormatter(fn: (...args: Date[]) => string) {
	return createFormatter(z.array(z.date()), fn);
}

type FormatterRecord = {
	[K in BaseMetaType]?: {
		/**
		 * Базовый форматтер для типа (по умолчанию)
		 */
		base: Omit<ODataFormatterDescription, "id">;
		/**
		 * Кастомные варианты форматтеров для типа
		 */
		[key: string]: Omit<ODataFormatterDescription, "id">;
	};
};

/*export*/ const formatODataDatetime = createDateFormatter(ODataDateFormat.datetime);
/*export*/ const formatODataDatetimeOffset = createDateFormatter(ODataDateFormat.datetimeOffset);
/*export*/ const formatODataTime = createDateFormatter(ODataDateFormat.time);
/*export*/ const formatODataAbapDate = createDateFormatter((value) => formatValidValue("string", formatDateAsAbapDate(value)));

/*export*/ const formatODataBoolean = createBooleanFormatter((value) => formatValidValue("boolean", value));
/*export*/ const formatODataBooleanAsChar = createBooleanFormatter((value) => formatValidValue("string", Number(value)));
/*export*/ const formatODataBooleanAsByte = createBooleanFormatter((value) => formatValidValue("byte", Number(value)));

/*export*/ const formatODataString = createStringFormatter((value) => formatValidValue("string", value));

/**
 * Форматтеры формируются только по базовым типам, по которым работают UI контролы.
 */
const formatters: FormatterRecord = {
	date: {
		base: {
			label: "Базовый datetime",
			description: "Используется для параметров OData с типом данных datetime",
			fn: formatODataDatetime
		},
		datetimeOffset: {
			label: "Базовый datetimeoffset",
			description: "Используется для параметров OData с типом данных datetimeoffset",
			fn: formatODataDatetimeOffset
		},
		time: {
			label: "Базовый time",
			description: "Используется для параметров OData с типом данных time",
			fn: formatODataTime
		},
		stringAbapDate: {
			label: "Дата ABAP YYYYMMDD",
			description: "Используется для параметров OData с типом данных string(8)",
			fn: formatODataAbapDate
		}
	},
	boolean: {
		base: {
			label: "Базовое ABAP булево",
			description: "Стандартный формат abap_bool со значением 'X' для true и '' для false",
			fn: formatODataBoolean
		},
		asChar: {
			label: "Как символ",
			description: "Преобразование булево в символы '0' или '1'",
			fn: formatODataBooleanAsChar
		},
		asByte: {
			label: "Как цифра",
			description: "Преобразование булево в цифру 0 или 1",
			fn: formatODataBooleanAsByte
		}
	},
	string: {
		base: {
			label: "Базовая строка",
			description: "",
			fn: formatODataString
		}
	}
};

export function getBaseTypeFromODataType<T extends ODataMetaType>(type: T): BaseMetaType {
	switch (type) {
		case "boolean":
			return "boolean";

		case "int":
		case "long":
		case "float":
		case "decimal":
		case "double":
		case "byte":
			return "number";

		case "datetime":
		case "datetimeOffset":
		case "time":
			return "date";

		default:
			return "string";
	}
}

export function getFormattersFor<T extends ODataMetaType>(type: T): ODataFormatterDescription[] {
	const group = formatters[getBaseTypeFromODataType(type)];
	if (!group) return [];

	return Object.entries(group).map(([id, fmt]) => ({
		id,
		...fmt
	}));
}

/**
 * Возвращает форматтеры напрямую по базовому типу UI-контрола.
 */
export function getFormattersForBaseType<T extends BaseMetaType>(type: T): ODataFormatterDescription[] {
	const group = formatters[type];
	if (!group) return [];

	return Object.entries(group).map(([id, fmt]) => ({
		id,
		...fmt
	}));
}

export function getFormatter<T extends ODataMetaType>(type: T, id: string) {
	return formatters[getBaseTypeFromODataType(type)]?.[id];
}

export function getFormatterForBaseType<T extends BaseMetaType>(type: T, id: string) {
	return formatters[type]?.[id];
}

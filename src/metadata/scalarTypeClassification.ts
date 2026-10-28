import {
	type BaseMetaType,
	type BooleanMetaType,
	type DateMetaType,
	type IntegerMetaType,
	type NumericMetaType,
	type ScalarMetaType
} from "./metadataTypes";

/** Определяет базовый тип поля для UI и Excel без инициализации протокольных модулей. */
export function getBaseTypeFromScalarType<T extends ScalarMetaType>(type: T): BaseMetaType {
	if (isScalarBooleanType(type)) return "boolean";
	if (isScalarNumericType(type)) return "number";
	if (isScalarDateType(type)) return "date";
	return "string";
}

export function isScalarBooleanType(type: ScalarMetaType | undefined): type is BooleanMetaType {
	return type === "boolean";
}

export function isScalarNumericType(type: ScalarMetaType | undefined): type is NumericMetaType {
	return type === "byte" || type === "int" || type === "long" || type === "float" || type === "decimal" || type === "double";
}

export function isScalarIntegerType(type: ScalarMetaType | undefined): type is IntegerMetaType {
	return type === "byte" || type === "int" || type === "long";
}

export function isScalarDateType(type: ScalarMetaType | undefined): type is DateMetaType {
	return type === "datetime" || type === "datetimeOffset" || type === "time";
}

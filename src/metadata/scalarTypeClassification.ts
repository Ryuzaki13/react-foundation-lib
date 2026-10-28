import {
	type BaseMetaType,
	type BooleanMetaType,
	type DateMetaType,
	type IntegerMetaType,
	type NumericMetaType,
	type ScalarMetaType
} from "./metadataTypes";
import {
	BASE_META_TYPE_DATE,
	BASE_META_TYPE_NUMBER,
	SCALAR_TYPE_BOOLEAN,
	SCALAR_TYPE_BYTE,
	SCALAR_TYPE_DATETIME,
	SCALAR_TYPE_DATETIME_OFFSET,
	SCALAR_TYPE_DECIMAL,
	SCALAR_TYPE_DOUBLE,
	SCALAR_TYPE_FLOAT,
	SCALAR_TYPE_INT,
	SCALAR_TYPE_LONG,
	SCALAR_TYPE_STRING,
	SCALAR_TYPE_TIME
} from "./scalarTypeConstants";

/** Определяет базовый тип поля для UI и Excel без инициализации протокольных модулей. */
export function getBaseTypeFromScalarType<T extends ScalarMetaType>(type: T): BaseMetaType {
	if (isScalarBooleanType(type)) return SCALAR_TYPE_BOOLEAN;
	if (isScalarNumericType(type)) return BASE_META_TYPE_NUMBER;
	if (isScalarDateType(type)) return BASE_META_TYPE_DATE;
	return SCALAR_TYPE_STRING;
}

export function isScalarBooleanType(type: ScalarMetaType | undefined): type is BooleanMetaType {
	return type === SCALAR_TYPE_BOOLEAN;
}

export function isScalarNumericType(type: ScalarMetaType | undefined): type is NumericMetaType {
	return (
		type === SCALAR_TYPE_BYTE ||
		type === SCALAR_TYPE_INT ||
		type === SCALAR_TYPE_LONG ||
		type === SCALAR_TYPE_FLOAT ||
		type === SCALAR_TYPE_DECIMAL ||
		type === SCALAR_TYPE_DOUBLE
	);
}

export function isScalarIntegerType(type: ScalarMetaType | undefined): type is IntegerMetaType {
	return type === SCALAR_TYPE_BYTE || type === SCALAR_TYPE_INT || type === SCALAR_TYPE_LONG;
}

export function isScalarDateType(type: ScalarMetaType | undefined): type is DateMetaType {
	return type === SCALAR_TYPE_DATETIME || type === SCALAR_TYPE_DATETIME_OFFSET || type === SCALAR_TYPE_TIME;
}

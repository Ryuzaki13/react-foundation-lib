/** Внутренние значения общей метамодели, независимые от OData и конкретных UI. */
export const SCALAR_TYPE_STRING = "string";
export const SCALAR_TYPE_BOOLEAN = "boolean";
export const SCALAR_TYPE_BYTE = "byte";
export const SCALAR_TYPE_INT = "int";
export const SCALAR_TYPE_LONG = "long";
export const SCALAR_TYPE_FLOAT = "float";
export const SCALAR_TYPE_DECIMAL = "decimal";
export const SCALAR_TYPE_DOUBLE = "double";
export const SCALAR_TYPE_DATETIME = "datetime";
export const SCALAR_TYPE_DATETIME_OFFSET = "datetimeOffset";
export const SCALAR_TYPE_TIME = "time";
export const SCALAR_TYPE_GUID = "guid";
export const SCALAR_TYPE_BINARY = "binary";

/** Базовая классификация объединяет конкретные скалярные типы для контролов. */
export const BASE_META_TYPE_NUMBER = "number";
export const BASE_META_TYPE_DATE = "date";

/** Аналитическая роль поля сохраняется общей для таблиц и протокольных адаптеров. */
export const SCALAR_ROLE_MEASURE = "measure";
export const SCALAR_ROLE_DIMENSION = "dimension";

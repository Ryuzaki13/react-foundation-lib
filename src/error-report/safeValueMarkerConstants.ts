/** Маркеры JSON-описаний общие для очищенных значений, preview и fallback payload. */
export const SAFE_VALUE_TYPE_TRUNCATED = "truncated";
export const SAFE_VALUE_TYPE_NON_FINITE_NUMBER = "non-finite-number";
export const SAFE_VALUE_TYPE_UNDEFINED = "undefined";
export const SAFE_VALUE_TYPE_FUNCTION = "function";
export const SAFE_VALUE_TYPE_SYMBOL = "symbol";
export const SAFE_VALUE_TYPE_INVALID_DATE = "invalid-date";
export const SAFE_VALUE_TYPE_UNKNOWN = "unknown";
export const SAFE_VALUE_TYPE_CIRCULAR = "circular";
export const SAFE_VALUE_TYPE_UNREADABLE = "unreadable";
export const SAFE_VALUE_TYPE_REDACTED = "redacted";

export const REDACTED_VALUE = "[REDACTED]";

/** Диапазон старшего surrogate защищает границу обрезанного UTF-16 текста. */
export const HIGH_SURROGATE_FIRST = 0xd800;
export const HIGH_SURROGATE_LAST = 0xdbff;

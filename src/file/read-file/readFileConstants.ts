/**
 * Приватные режимы чтения и типов options/result. Отдельные константы позволяют
 * минификатору сокращать идентификаторы без сохранения имён свойств объекта.
 */
export const READ_FILE_MODE_DATA_URL = "data-url";
export const READ_FILE_MODE_ARRAY_BUFFER = "array-buffer";

/** Значения сохраняют публичный контракт ошибок; тип выводится из этих же констант. */
export const READ_FILE_ERROR_NO_FILE = "NO_FILE";
export const READ_FILE_ERROR_MIME_NOT_ALLOWED = "MIME_NOT_ALLOWED";
export const READ_FILE_ERROR_FILE_TOO_LARGE = "FILE_TOO_LARGE";
export const READ_FILE_ERROR_READ_ABORTED = "READ_ABORTED";
export const READ_FILE_ERROR_READ_FAILED = "READ_FAILED";

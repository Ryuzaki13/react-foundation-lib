export const ZIP_COMPRESSION_STORE = "store";
export const ZIP_COMPRESSION_DEFLATE = "deflate";
export const ZIP_MIME_TYPE = "application/zip";

// Обычный ZIP: предельные значения количества и размеров зарезервированы под ZIP64.
export const ZIP64_ENTRY_COUNT_MARKER = 0xffff;
export const ZIP64_SIZE_MARKER = 0xffffffff;
export const ZIP64_ARCHIVE_SIZE_MESSAGE = "Размер архива требует ZIP64, который не поддерживается";
export const ZIP_FILENAME_MAX_BYTES = 0xffff;
export const ZIP_END_RECORD_BYTES = 22;
export const ZIP_CENTRAL_DIRECTORY_ENTRY_BYTES = 46;
export const ZIP_ENTRY_OVERHEAD_BYTES = 30 + 16 + ZIP_CENTRAL_DIRECTORY_ENTRY_BYTES;

// Ограничены и чтение Blob, и подача в компрессор; готовый архив остаётся в памяти.
export const ZIP_READ_CHUNK_BYTES = 64 * 1024;
export const ZIP_MAIN_THREAD_BUDGET_MS = 8;

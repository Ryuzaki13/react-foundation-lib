import { isRecord } from "../validators";

/** Отличает отсутствующий путь от ошибок доступа и I/O, которые вызывающий код обязан обработать отдельно. */
export function isFileSystemNotFoundError(error: unknown): boolean {
	if (!isRecord(error)) return false;
	return error.code === "ENOENT" || error.code === "ENOTDIR";
}

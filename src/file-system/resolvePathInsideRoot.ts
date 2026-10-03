import { type PathRealpathMode, type ResolvePathInsideRootOptions } from "./fileSystemTypes";

import { realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

function resolveStorageRoot(rootPath: string): string {
	const normalizedRootPath = rootPath.trim();
	if (!normalizedRootPath) {
		throw new Error("Корневая папка хранилища не задана.");
	}
	return resolve(normalizedRootPath);
}

function isResolvedPathInsideRoot(rootPath: string, candidatePath: string): boolean {
	const relativePath = relative(rootPath, candidatePath);
	// Проверяется сегмент родителя, а не префикс имени: '..metadata' является допустимым файлом внутри root.
	return relativePath === "" || (relativePath !== ".." && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath));
}

async function assertRealPathInsideRoot(
	rootPath: string,
	candidatePath: string,
	realpathMode: Exclude<PathRealpathMode, "none">
): Promise<void> {
	let realRootPath: string;
	try {
		realRootPath = await realpath(rootPath);
	} catch (error) {
		throw new Error("Корневая папка хранилища недоступна.", { cause: error });
	}
	const pathForRealCheck = realpathMode === "parent" ? dirname(candidatePath) : candidatePath;
	const realCandidatePath = await realpath(pathForRealCheck);
	if (!isResolvedPathInsideRoot(realRootPath, realCandidatePath)) {
		throw new Error("Путь выходит за пределы корневой папки хранилища.");
	}
}

/**
 * Нормализует абсолютный путь и запрещает выход за доверенный root.
 * 'target' проверяет существующий файл, 'parent' — каталог перед созданием файла,
 * 'none' выполняет только лексическую проверку и не защищает от символических ссылок.
 * Проверка не открывает файл: защиту от смены пути между проверкой и I/O обеспечивает вызывающий код.
 */
export async function resolvePathInsideRoot({
	rootPath,
	pathSegments,
	realpathMode = "target"
}: ResolvePathInsideRootOptions): Promise<string> {
	const resolvedRootPath = resolveStorageRoot(rootPath);
	const resolvedCandidatePath = resolve(resolvedRootPath, ...pathSegments);
	if (!isResolvedPathInsideRoot(resolvedRootPath, resolvedCandidatePath)) {
		throw new Error("Путь выходит за пределы корневой папки хранилища.");
	}
	if (realpathMode !== "none") {
		await assertRealPathInsideRoot(resolvedRootPath, resolvedCandidatePath, realpathMode);
	}
	return resolvedCandidatePath;
}

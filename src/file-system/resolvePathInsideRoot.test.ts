import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isFileSystemNotFoundError, resolvePathInsideRoot } from "./index";

import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

let testRoot: string;
let outsideRoot: string;

beforeEach(async () => {
	testRoot = await mkdtemp(join(tmpdir(), "foundation-path-root-"));
	outsideRoot = await mkdtemp(join(tmpdir(), "foundation-path-outside-"));
	await mkdir(join(testRoot, "docs"));
	await writeFile(join(testRoot, "docs", "file.txt"), "content");
	await writeFile(join(outsideRoot, "secret.txt"), "secret");
});

afterEach(async () => {
	await Promise.all([rm(testRoot, { force: true, recursive: true }), rm(outsideRoot, { force: true, recursive: true })]);
});

describe("resolvePathInsideRoot", () => {
	it("нормализует относительный root от process.cwd()", async () => {
		await expect(
			resolvePathInsideRoot({ rootPath: relative(process.cwd(), testRoot), pathSegments: ["docs", "file.txt"] })
		).resolves.toBe(resolve(testRoot, "docs", "file.txt"));
	});

	it("нормализует внутренние dot-сегменты без выхода из root", async () => {
		await expect(resolvePathInsideRoot({ rootPath: testRoot, pathSegments: ["docs", ".", "unused", "..", "file.txt"] })).resolves.toBe(
			join(testRoot, "docs", "file.txt")
		);
	});

	it("разрешает сам существующий root и убирает внешние пробелы конфигурации", async () => {
		await expect(resolvePathInsideRoot({ rootPath: `  ${testRoot}  `, pathSegments: [] })).resolves.toBe(testRoot);
	});

	it("отклоняет пустую конфигурацию root", async () => {
		await expect(resolvePathInsideRoot({ rootPath: "  ", pathSegments: [], realpathMode: "none" })).rejects.toThrow(
			"Корневая папка хранилища не задана."
		);
	});

	it("запрещает выход через parent-сегменты", async () => {
		await expect(
			resolvePathInsideRoot({ rootPath: testRoot, pathSegments: ["..", "secret.txt"], realpathMode: "none" })
		).rejects.toThrow("Путь выходит за пределы корневой папки хранилища.");
	});

	it("не считает соседнюю папку с общим строковым префиксом частью root", async () => {
		await expect(
			resolvePathInsideRoot({ rootPath: testRoot, pathSegments: [`${testRoot}-sibling`, "file.txt"], realpathMode: "none" })
		).rejects.toThrow("Путь выходит за пределы корневой папки хранилища.");
	});

	it("запрещает абсолютный путь вне root", async () => {
		await expect(
			resolvePathInsideRoot({ rootPath: testRoot, pathSegments: [join(outsideRoot, "secret.txt")], realpathMode: "none" })
		).rejects.toThrow("Путь выходит за пределы корневой папки хранилища.");
	});

	it("разрешает абсолютный путь, который остаётся внутри root", async () => {
		await expect(resolvePathInsideRoot({ rootPath: testRoot, pathSegments: [join(testRoot, "docs", "file.txt")] })).resolves.toBe(
			join(testRoot, "docs", "file.txt")
		);
	});

	it("разрешает имя с префиксом из двух точек внутри root", async () => {
		await writeFile(join(testRoot, "..metadata"), "content");
		await expect(resolvePathInsideRoot({ rootPath: testRoot, pathSegments: ["..metadata"] })).resolves.toBe(
			join(testRoot, "..metadata")
		);
	});

	it("запрещает target symlink за пределы root", async () => {
		await symlink(join(outsideRoot, "secret.txt"), join(testRoot, "docs", "secret-link.txt"));
		await expect(resolvePathInsideRoot({ rootPath: testRoot, pathSegments: ["docs", "secret-link.txt"] })).rejects.toThrow(
			"Путь выходит за пределы корневой папки хранилища."
		);
	});

	it("запрещает parent symlink за пределы root перед созданием нового файла", async () => {
		await symlink(outsideRoot, join(testRoot, "outside"));
		await expect(
			resolvePathInsideRoot({ rootPath: testRoot, pathSegments: ["outside", "new-file.txt"], realpathMode: "parent" })
		).rejects.toThrow("Путь выходит за пределы корневой папки хранилища.");
	});

	it("разрешает symlink на target внутри того же root", async () => {
		await symlink(join(testRoot, "docs", "file.txt"), join(testRoot, "file-link.txt"));
		await expect(resolvePathInsideRoot({ rootPath: testRoot, pathSegments: ["file-link.txt"] })).resolves.toBe(
			join(testRoot, "file-link.txt")
		);
	});

	it("сопоставляет realpath root, если доверенный root сам является symlink", async () => {
		const rootLink = join(outsideRoot, "root-link");
		await symlink(testRoot, rootLink);
		await expect(resolvePathInsideRoot({ rootPath: rootLink, pathSegments: ["docs", "file.txt"] })).resolves.toBe(
			join(rootLink, "docs", "file.txt")
		);
	});

	it("разрешает отсутствующий target при существующем parent", async () => {
		await expect(
			resolvePathInsideRoot({ rootPath: testRoot, pathSegments: ["docs", "new-file.txt"], realpathMode: "parent" })
		).resolves.toBe(join(testRoot, "docs", "new-file.txt"));
	});

	it("сохраняет ENOENT для отсутствующего target при realpath-проверке", async () => {
		const error = await resolvePathInsideRoot({ rootPath: testRoot, pathSegments: ["missing.txt"] }).catch((error: unknown) => error);
		expect(isFileSystemNotFoundError(error)).toBe(true);
	});

	it("не разрешает отсутствующий parent в режиме parent", async () => {
		const error = await resolvePathInsideRoot({
			rootPath: testRoot,
			pathSegments: ["missing-directory", "new.txt"],
			realpathMode: "parent"
		}).catch((error: unknown) => error);
		expect(isFileSystemNotFoundError(error)).toBe(true);
	});

	it("сохраняет ENOTDIR, когда промежуточный сегмент является файлом", async () => {
		const error = await resolvePathInsideRoot({
			rootPath: testRoot,
			pathSegments: ["docs", "file.txt", "child.txt"]
		}).catch((error: unknown) => error);
		expect(isFileSystemNotFoundError(error)).toBe(true);
	});

	it("сообщает о недоступном root в режиме проверки файловой системы", async () => {
		await expect(resolvePathInsideRoot({ rootPath: join(testRoot, "missing-root"), pathSegments: [] })).rejects.toThrow(
			"Корневая папка хранилища недоступна."
		);
	});

	it("в режиме none разрешает отсутствующие root и target после лексической проверки", async () => {
		await expect(
			resolvePathInsideRoot({ rootPath: join(testRoot, "missing-root"), pathSegments: ["new.txt"], realpathMode: "none" })
		).resolves.toBe(join(testRoot, "missing-root", "new.txt"));
	});
});

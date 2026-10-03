import { describe, expect, it } from "vitest";

import { isFileSystemNotFoundError } from "./index";

describe("isFileSystemNotFoundError", () => {
	it.each(["ENOENT", "ENOTDIR"])("распознаёт системный код %s", (code) => {
		expect(isFileSystemNotFoundError(Object.assign(new Error("Ошибка файловой системы"), { code }))).toBe(true);
	});

	it.each([{ code: "EACCES" }, { code: "EIO" }, { code: 2 }, new Error("ENOENT"), null, undefined, "ENOENT"])(
		"сохраняет отличие других ошибок и произвольного входа: %s",
		(error) => {
			expect(isFileSystemNotFoundError(error)).toBe(false);
		}
	);
});

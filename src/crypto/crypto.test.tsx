import { afterEach, describe, expect, it, vi } from "vitest";

import { hashString, hashString128, hashString128Base64Url, stringToElementId } from "./hashString";
import { uuidv4 } from "./uuid";

describe("hashString", () => {
	it("детерминированно хеширует одинаковую строку", () => {
		expect(hashString("строка")).toBe(hashString("строка"));
		expect(hashString128("строка")).toBe(hashString128("строка"));
		expect(hashString128Base64Url("строка")).toBe(hashString128Base64Url("строка"));
	});

	it("разводит разные строки и возвращает компактные безопасные форматы", () => {
		expect(hashString("строка-a")).not.toBe(hashString("строка-b"));
		expect(hashString("строка")).toMatch(/^[0-9a-z]+$/);
		expect(hashString128("строка")).toMatch(/^[0-9a-f]{32}$/);
		expect(hashString128Base64Url("строка")).toMatch(/^[0-9A-Za-z_-]+$/);
	});

	it("строит стабильный id элемента с настраиваемым префиксом", () => {
		const id = stringToElementId("row:42", "cell");

		expect(id).toBe(stringToElementId("row:42", "cell"));
		expect(id).toMatch(/^cell-[0-9A-Za-z_-]+$/);
	});
});

describe("uuidv4", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("использует native randomUUID, если он доступен", () => {
		const randomUUID = vi.fn(() => "native-uuid");
		vi.stubGlobal("crypto", { randomUUID } as unknown as Crypto);

		expect(uuidv4()).toBe("native-uuid");
		expect(randomUUID).toHaveBeenCalledOnce();
	});

	it("собирает RFC 4122 uuid v4 из getRandomValues", () => {
		const getRandomValues = vi.fn((bytes: Uint8Array) => {
			bytes.set([0, 1, 2, 3, 4, 5, 0xff, 7, 0xff, 9, 10, 11, 12, 13, 14, 15]);
			return bytes;
		});
		vi.stubGlobal("crypto", { getRandomValues } as unknown as Crypto);

		expect(uuidv4()).toBe("00010203-0405-4f07-bf09-0a0b0c0d0e0f");
		expect(getRandomValues).toHaveBeenCalledOnce();
	});
});

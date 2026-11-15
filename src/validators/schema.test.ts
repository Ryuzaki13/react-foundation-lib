import { describe, expect, it } from "vitest";

import { httpUrlSchema } from "./schema";

describe("схема полного HTTP(S)-адреса", () => {
	it.each([
		"https://example.org",
		"HTTPS://EXAMPLE.ORG/путь%20к%20встрече?from=mail#start",
		"http://localhost:7575/room",
		"http://127.0.0.1:7575/room",
		"https://[::1]:7575/room"
	])("возвращает исходный адрес %j", (value) => {
		expect(httpUrlSchema.parse(value)).toBe(value);
	});

	it.each([
		null,
		"",
		"example.org/room",
		"/room",
		"//example.org/room",
		"https:example.org",
		"https:///example.org/room",
		"https://",
		"https://example.org:99999/room",
		"https://example.org/a b",
		"https://example.org/a\\b",
		"https://example.org/a\nb",
		" https://example.org",
		"https://example.org ",
		"ftp://example.org/room",
		"javascript:alert(1)"
	])("отклоняет адрес %j", (value) => {
		expect(httpUrlSchema.safeParse(value).success).toBe(false);
	});

	it("возвращает одно пояснение ошибки формата", () => {
		const result = httpUrlSchema.safeParse("https:///example.org");
		expect(result).toMatchObject({ success: false, error: { issues: [{ message: expect.stringContaining("полный адрес") }] } });
	});
});

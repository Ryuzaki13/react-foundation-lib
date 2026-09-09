import { afterEach, describe, expect, it } from "vitest";

import { createDiagnosticValue, getUtf8TextSize, sanitizeDetail, sanitizeDiagnosticTextBytes, setErrorReportSanitizer } from "./safeValue";

afterEach(() => {
	setErrorReportSanitizer(undefined);
});

describe("error-report sanitizer", () => {
	it("удаляет известные секреты, email и URL search/hash по умолчанию", () => {
		const value = createDiagnosticValue({
			authorization: "Bearer top-secret-token",
			endpoint: "/api/students?fullName=Иванов#result",
			requestUrl: "https://ktk.example/api/orders?access_token=secret#result",
			email: "user@example.com",
			nested: { password: "secret-password", operation: "orders.read" }
		});
		const serialized = JSON.stringify(value);

		expect(serialized).toContain("[REDACTED]");
		expect(serialized).toContain("https://ktk.example/api/orders");
		expect(serialized).toContain('"endpoint":"/api/students"');
		expect(serialized).toContain("[REDACTED_EMAIL]");
		expect(serialized).not.toContain("top-secret-token");
		expect(serialized).not.toContain("access_token");
		expect(serialized).not.toContain("secret-password");
	});

	it("помечает циклические ссылки и не бросает исключение", () => {
		const cyclic: Record<string, unknown> = { operation: "orders.read" };
		cyclic.self = cyclic;

		expect(createDiagnosticValue(cyclic)).toEqual({
			operation: "orders.read",
			self: { type: "circular" }
		});
	});

	it("заменяет невалидные JSON-значения явными marker", () => {
		expect(createDiagnosticValue({ date: new Date("invalid"), number: Number.POSITIVE_INFINITY })).toEqual({
			date: { type: "invalid-date" },
			number: { type: "non-finite-number" }
		});
	});

	it("ограничивает Unicode text по UTF-8 bytes без разрыва символа", () => {
		const value = sanitizeDiagnosticTextBytes("😀".repeat(100), 65);

		expect(getUtf8TextSize(value)).toBeLessThanOrEqual(65);
		expect(value.endsWith("\ud83d")).toBe(false);
	});

	it("даёт приложению удалить PII-shaped поля по предметному allow-list", () => {
		setErrorReportSanitizer((value, context) => {
			if (context.scope !== "context" || !value || Array.isArray(value) || typeof value !== "object") return value;
			return "operation" in value ? { operation: value.operation } : undefined;
		});

		const detail = sanitizeDetail({
			operation: "student.open",
			fullName: "Иванов Иван Иванович",
			phone: "+7 900 000-00-00"
		});

		expect(detail).toEqual({ operation: "student.open" });
	});

	it("удаляет секцию, если sanitizer приложения бросает исключение", () => {
		setErrorReportSanitizer(() => {
			throw new Error("policy failed");
		});

		expect(sanitizeDetail({ operation: "student.open" })).toBeUndefined();
	});
});

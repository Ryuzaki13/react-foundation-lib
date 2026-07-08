// @vitest-environment jsdom

import { QueryClient } from "@tanstack/react-query";
import { indexedDB } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";

import { createIndexedDbQueryStorage, REACT_QUERY_PERSISTENCE_BUSTER } from "../query-client";

import { collectPersistedQueryDiagnostics, collectQueryClientDiagnostics } from "./diagnostics";
import { isErrorReportingEnabled } from "./environment";
import { createErrorInfo } from "./errorInfo";
import { reportRuntimeError, setErrorReportRuntimeErrorReporter } from "./runtime";

import type { PersistedQuery } from "@tanstack/query-persist-client-core";

afterEach(() => {
	Reflect.deleteProperty(globalThis, "indexedDB");
	setErrorReportRuntimeErrorReporter(undefined);
	sessionStorage.clear();
});

describe("error-report", () => {
	it("включается в браузере только вне dev-режима", () => {
		expect(isErrorReportingEnabled({ isDev: false })).toBe(true);
		expect(isErrorReportingEnabled({ isDev: true })).toBe(false);
	});

	it("собирает query diagnostics с читаемым queryKey, включая значения его полей, но без query data", () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData(["orders", { customer: "1000", token: "token-is-not-used" }], {
			password: "secret-password",
			rows: [{ id: "42", amount: 1000 }]
		});

		const diagnostics = collectQueryClientDiagnostics(queryClient);
		const serialized = JSON.stringify(diagnostics);

		expect(serialized).toContain("queryHash");
		expect(serialized).toContain("1000");
		expect(serialized).toContain("orders");
		expect(serialized).toContain("token-is-not-used");
		expect(serialized).toContain("dataShape");
		expect(serialized).not.toContain("secret-password");
		expect(serialized).not.toContain('amount":1000');
	});

	it("собирает persisted diagnostics без state.data", async () => {
		Object.defineProperty(globalThis, "indexedDB", {
			configurable: true,
			value: indexedDB
		});

		const storage = createIndexedDbQueryStorage<PersistedQuery>({ indexedDB });
		await storage!.setItem("ktk:cache-query-hash", {
			buster: REACT_QUERY_PERSISTENCE_BUSTER,
			queryHash: "query-hash",
			queryKey: ["metadata", { service: "TEXT_APP_SRV", authorization: "secret" }],
			state: {
				data: { payload: "must-not-leak" },
				dataUpdatedAt: 123,
				errorUpdatedAt: 0,
				fetchFailureCount: 0,
				fetchStatus: "idle",
				status: "success"
			}
		} as unknown as PersistedQuery);

		const diagnostics = await collectPersistedQueryDiagnostics();
		const serialized = JSON.stringify(diagnostics);

		expect(serialized).toContain("query-hash");
		expect(serialized).toContain("ktk:cache-query-hash");
		expect(serialized).toContain("TEXT_APP_SRV");
		expect(serialized).toContain("authorization");
		expect(serialized).toContain("secret");
		expect(serialized).not.toContain("must-not-leak");
	});

	it("сохраняет stacktrace при нормализации runtime ошибки", () => {
		const error = new Error("boom");
		error.stack = "Error: boom\n    at test.ts:1:1";

		expect(createErrorInfo(error)).toEqual({
			name: "Error",
			message: "boom",
			stackTrace: "Error: boom\n    at test.ts:1:1"
		});
	});

	it("читает serverFn appError transport как отдельный класс ошибки", () => {
		expect(
			createErrorInfo({
				appError: {
					type: "appError",
					version: 1,
					kind: "unexpected",
					code: "dbQueryError",
					status: 500,
					message: "Внутренняя ошибка сервера."
				}
			})
		).toEqual({
			name: "AppError",
			message: "Внутренняя ошибка сервера.",
			code: "dbQueryError",
			httpStatus: 500
		});
	});

	it("публикует ручную runtime-ошибку без QueryClient в вызывающем коде", async () => {
		const calls: Array<{ error: unknown; source?: string }> = [];
		setErrorReportRuntimeErrorReporter((error, context) => {
			const source = context.detail?.source;
			calls.push({ error, source: typeof source === "string" ? source : undefined });
		});

		const error = new Error("manual boom");
		await reportRuntimeError(error, {
			detail: { source: "manual_try_catch" }
		});

		expect(calls).toEqual([{ error, source: "manual_try_catch" }]);
	});
});

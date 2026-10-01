// @vitest-environment jsdom

import { QueryClient } from "@tanstack/react-query";
import { indexedDB } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";

import { hashString128 } from "../crypto";
import { createIndexedDbQueryStorage, REACT_QUERY_PERSISTENCE_BUSTER } from "../query-client";

import { setErrorReportCaptureOptions } from "./captureOptions";
import { collectMutationDiagnostics, collectPersistedQueryDiagnostics, collectQueryClientDiagnostics } from "./diagnostics";
import { isErrorReportingEnabled } from "./environment";
import { createErrorInfo } from "./errorInfo";
import { reportRuntimeError, setErrorReportRuntimeErrorReporter } from "./runtime";

import type { PersistedQuery } from "@tanstack/query-persist-client-core";

afterEach(() => {
	Reflect.deleteProperty(globalThis, "indexedDB");
	setErrorReportRuntimeErrorReporter(undefined);
	setErrorReportCaptureOptions(undefined);
	sessionStorage.clear();
});

describe("error-report", () => {
	it("включается в браузере только вне dev-режима", () => {
		expect(isErrorReportingEnabled({ isDev: false })).toBe(true);
		expect(isErrorReportingEnabled({ isDev: true })).toBe(false);
	});

	it("собирает query diagnostics без секретов и полных query data", () => {
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
		expect(serialized).toContain("[REDACTED]");
		expect(serialized).not.toContain("token-is-not-used");
		expect(serialized).toContain("dataShape");
		expect(serialized).not.toContain("secret-password");
		expect(serialized).not.toContain('amount":1000');
	});

	it("в verbatim-режиме сохраняет исходный queryHash, ключ и ограниченный снимок данных", () => {
		setErrorReportCaptureOptions({ valuePolicy: "verbatim", dataPreviewBytes: { query: 2_048 } });
		const queryClient = new QueryClient();
		const queryKey = ["orders", { filter: "customer=1000", token: "example-token" }] as const;
		queryClient.setQueryData(queryKey, { rows: [{ id: 42, description: "x".repeat(3_000) }] });
		const query = queryClient.getQueryCache().find({ queryKey });
		const diagnostic = collectQueryClientDiagnostics(queryClient).queries[0];

		expect(diagnostic.queryHash).toBe(hashString128(query!.queryHash));
		expect(diagnostic.queryKey).toEqual(queryKey);
		expect(diagnostic.dataPreview?.truncated).toBe(true);
		expect(new TextEncoder().encode(diagnostic.dataPreview?.json).byteLength).toBeLessThanOrEqual(2_048);
		expect(JSON.parse(diagnostic.dataPreview!.json)).toMatchObject({ rows: [{ id: 42 }] });
	});

	it("различает исходные queryHash при одинаково усечённых длинных ключах", () => {
		setErrorReportCaptureOptions({ valuePolicy: "verbatim" });
		const queryClient = new QueryClient();
		const common = "x".repeat(9_000);
		queryClient.setQueryData(["orders", `${common}first`], { id: 1 });
		queryClient.setQueryData(["orders", `${common}other`], { id: 2 });
		const diagnostics = collectQueryClientDiagnostics(queryClient).queries;

		expect(diagnostics[0].queryKey).toEqual(diagnostics[1].queryKey);
		expect(diagnostics[0].queryHash).not.toBe(diagnostics[1].queryHash);
		expect(diagnostics[0].queryHash).toHaveLength(32);
	});

	it("сохраняет различимыми значения queryKey длиннее прежних 4096 символов", () => {
		setErrorReportCaptureOptions({ valuePolicy: "verbatim" });
		const queryClient = new QueryClient();
		const common = "x".repeat(5_000);
		queryClient.setQueryData(["orders", `${common}first`], { id: 1 });
		queryClient.setQueryData(["orders", `${common}second`], { id: 2 });
		const diagnostics = collectQueryClientDiagnostics(queryClient).queries;

		expect(diagnostics[0].queryKey).toEqual(["orders", `${common}first`]);
		expect(diagnostics[1].queryKey).toEqual(["orders", `${common}second`]);
	});

	it("указывает число query вне 40 последних записей снимка", () => {
		const queryClient = new QueryClient();
		for (let index = 0; index < 45; index += 1) queryClient.setQueryData(["orders", index], index);

		const diagnostic = collectQueryClientDiagnostics(queryClient);
		expect(diagnostic.queries).toHaveLength(40);
		expect(diagnostic.omittedQueries).toBe(5);
	});

	it("в verbatim-режиме сохраняет ограниченные variables мутации", async () => {
		setErrorReportCaptureOptions({ valuePolicy: "verbatim", dataPreviewBytes: { mutation: 512 } });
		const queryClient = new QueryClient();
		const mutation = queryClient.getMutationCache().build(queryClient, {
			mutationKey: ["save", { id: 42 }],
			mutationFn: async (variables: { id: number; comment: string }) => variables
		});
		await mutation.execute({ id: 42, comment: "x".repeat(3_000) });
		const diagnostic = collectMutationDiagnostics(mutation);

		expect(diagnostic.mutationKey).toEqual(["save", { id: 42 }]);
		expect(diagnostic.variablesPreview?.truncated).toBe(true);
		expect(new TextEncoder().encode(diagnostic.variablesPreview?.json).byteLength).toBeLessThanOrEqual(512);
		expect(JSON.parse(diagnostic.variablesPreview!.json)).toMatchObject({ id: 42 });
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

		expect(serialized).toContain("queryHash");
		expect(serialized).toContain("TEXT_APP_SRV");
		expect(serialized).toContain("authorization");
		expect(serialized).toContain("[REDACTED]");
		expect(serialized).not.toContain('"authorization":"secret"');
		expect(serialized).not.toContain("ktk:cache-query-hash");
		expect(serialized).not.toContain("must-not-leak");
	});

	it("в verbatim-режиме использует сохранённый hash и ограниченный preview persisted data", async () => {
		setErrorReportCaptureOptions({ valuePolicy: "verbatim", dataPreviewBytes: { persistedQuery: 512 } });
		Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: indexedDB });
		const storage = createIndexedDbQueryStorage<PersistedQuery>({ indexedDB });
		await storage!.setItem("ktk:verbatim-query-hash", {
			buster: REACT_QUERY_PERSISTENCE_BUSTER,
			queryHash: "original-query-hash",
			queryKey: ["orders", { requestUrl: "/api/orders?customer=1000" }],
			state: {
				data: { rows: [{ id: 42, comment: "x".repeat(3_000) }] },
				dataUpdatedAt: 123,
				errorUpdatedAt: 0,
				fetchFailureCount: 0,
				fetchStatus: "idle",
				status: "success"
			}
		} as unknown as PersistedQuery);

		const diagnostic = (await collectPersistedQueryDiagnostics()).find(
			(query) => query.queryHash === hashString128("original-query-hash")
		);
		expect(diagnostic?.queryKey).toEqual(["orders", { requestUrl: "/api/orders?customer=1000" }]);
		expect(diagnostic?.dataPreview?.truncated).toBe(true);
		expect(new TextEncoder().encode(diagnostic?.dataPreview?.json).byteLength).toBeLessThanOrEqual(512);
		expect(JSON.parse(diagnostic!.dataPreview!.json)).toMatchObject({ rows: [{ id: 42 }] });
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

	it("в verbatim-режиме не обрезает сообщение после 4096 символов и помечает предел 128 KiB", () => {
		setErrorReportCaptureOptions({ valuePolicy: "verbatim" });
		const ordinary = createErrorInfo(new Error(`${"x".repeat(5_000)}END`));
		const oversized = createErrorInfo(new Error("x".repeat(130 * 1_024)));

		expect(ordinary.message).toMatch(/END$/);
		expect(oversized.message).toContain("[TRUNCATED:");
		expect(new TextEncoder().encode(oversized.message).byteLength).toBeLessThanOrEqual(128 * 1_024);
	});

	it("подставляет сообщение по умолчанию для ошибки без текста", () => {
		expect(createErrorInfo(new Error()).message).toBe("Неизвестная ошибка");
		expect(createErrorInfo("").message).toBe("Неизвестная ошибка");
		expect(createErrorInfo("   ").message).toBe("Неизвестная ошибка");
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

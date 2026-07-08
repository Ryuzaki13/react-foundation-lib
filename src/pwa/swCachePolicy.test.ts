import { describe, expect, it } from "vitest";

import { buildSwCachePolicyValue, parseSwCachePolicy, resolveSwCacheCacheNameByPolicy } from "./swCachePolicy";

describe("swCachePolicy", () => {
	it("разбирает гибкую ttl-политику с max и name", () => {
		expect(parseSwCachePolicy("ttl=10m;max=200;name=ui")).toMatchObject({
			mode: "ttl",
			amount: 10,
			unit: "m",
			name: "ui",
			maxEntries: 200,
			resolvedMaxEntries: 200,
			ttlMs: 10 * 60 * 1000,
			cacheName: "odata-ui-10m-max200"
		});
	});

	it("не принимает имя профиля внутри duration", () => {
		expect(parseSwCachePolicy("bust=ref24h")).toBeUndefined();
	});

	it("собирает значение из draft компонента", () => {
		expect(buildSwCachePolicyValue({ mode: "ttl", amount: 6, unit: "h", maxEntries: 150, name: "dict ref" })).toBe(
			"ttl=6h;max=150;name=dict-ref"
		);
		expect(buildSwCachePolicyValue({ mode: "off" })).toBe("off");
	});

	it("разрешает имя кеша только по полной политике", () => {
		expect(resolveSwCacheCacheNameByPolicy("ref24h")).toBeUndefined();
		expect(resolveSwCacheCacheNameByPolicy("ttl=24h;name=ref")).toBe("odata-ref-24h");
		expect(resolveSwCacheCacheNameByPolicy("ttl=168h;name=ref")).toBe("odata-ref-168h");
		expect(resolveSwCacheCacheNameByPolicy("ttl=10m;max=200;name=ui")).toBe("odata-ui-10m-max200");
	});

	it("поддерживает бесконечную ttl/bust-политику", () => {
		expect(parseSwCachePolicy("ttl=forever;name=ref")).toMatchObject({
			mode: "ttl",
			name: "ref",
			resolvedMaxEntries: 100,
			ttlMs: Infinity,
			cacheName: "odata-ref-forever"
		});
		expect(parseSwCachePolicy("bust=forever;name=ref")).toMatchObject({
			mode: "bust",
			name: "ref",
			resolvedMaxEntries: 100,
			ttlMs: Infinity,
			cacheName: "odata-ref-forever"
		});
		expect(resolveSwCacheCacheNameByPolicy("ttl=forever;name=ref")).toBe("odata-ref-forever");
		expect(resolveSwCacheCacheNameByPolicy("bust=forever;name=ref")).toBe("odata-ref-forever");
	});
});

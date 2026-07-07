import { beforeEach, describe, expect, it } from "vitest";

import { createFixedResolver, registerFixedResolver } from "./fixedValueStateResolver";
import { registerThresholdResolver } from "./thresholdValueStateResolver";
import { getValueStateResolver, getValueStateResolverIds, resetValueStateResolvers, resolveValueState } from "./valueStateRegistry";

beforeEach(() => {
	resetValueStateResolvers();
});

// ────────────────────────────────────────────────────────────────
// createFixedResolver (прямое использование)
// ────────────────────────────────────────────────────────────────

describe("createFixedResolver", () => {
	describe("базовый маппинг строковых значений", () => {
		const resolve = createFixedResolver({
			entries: {
				"01": "success",
				"02": "warning",
				"03": "error"
			}
		});

		it("возвращает State по точному совпадению", () => {
			expect(resolve("01")).toBe("success");
			expect(resolve("02")).toBe("warning");
			expect(resolve("03")).toBe("error");
		});

		it("возвращает fallback для значений вне маппинга", () => {
			expect(resolve("04")).toBe("none");
			expect(resolve("99")).toBe("none");
			expect(resolve("")).toBe("none");
		});
	});

	describe("числовые значения приводятся к строке", () => {
		const resolve = createFixedResolver({
			entries: {
				"1": "success",
				"2": "warning",
				"100": "error"
			}
		});

		it("числа преобразуются через String()", () => {
			expect(resolve(1)).toBe("success");
			expect(resolve(2)).toBe("warning");
			expect(resolve(100)).toBe("error");
		});
	});

	describe("пользовательский fallbackState", () => {
		const resolve = createFixedResolver({
			entries: { A: "success" },
			fallbackState: "error"
		});

		it("неизвестные значения возвращают указанный fallback", () => {
			expect(resolve("B")).toBe("error");
			expect(resolve("")).toBe("error");
		});
	});

	describe("null и undefined", () => {
		const resolve = createFixedResolver({
			entries: { null: "information", undefined: "warning" }
		});

		it("null и undefined возвращают fallback (не маппятся через String)", () => {
			expect(resolve(null)).toBe("none");
			expect(resolve(undefined)).toBe("none");
		});
	});

	describe("пустой маппинг", () => {
		const resolve = createFixedResolver({
			entries: {},
			fallbackState: "success"
		});

		it("любое значение возвращает fallback", () => {
			expect(resolve("anything")).toBe("success");
			expect(resolve(42)).toBe("success");
		});
	});

	describe("дедупликация", () => {
		it("одинаковые конфигурации возвращают ту же функцию", () => {
			const resolve1 = createFixedResolver({
				entries: { "01": "success", "02": "warning" }
			});
			const resolve2 = createFixedResolver({
				entries: { "01": "success", "02": "warning" }
			});

			expect(resolve1).toBe(resolve2);
		});

		it("разный порядок ключей не влияет (дедуплицируется)", () => {
			const resolve1 = createFixedResolver({
				entries: { "02": "warning", "01": "success" }
			});
			const resolve2 = createFixedResolver({
				entries: { "01": "success", "02": "warning" }
			});

			expect(resolve1).toBe(resolve2);
		});

		it("разные конфигурации возвращают разные функции", () => {
			const resolve1 = createFixedResolver({
				entries: { "01": "success" }
			});
			const resolve2 = createFixedResolver({
				entries: { "01": "error" }
			});

			expect(resolve1).not.toBe(resolve2);
		});

		it("разный fallbackState — разные функции", () => {
			const resolve1 = createFixedResolver({
				entries: { "01": "success" },
				fallbackState: "none"
			});
			const resolve2 = createFixedResolver({
				entries: { "01": "success" },
				fallbackState: "error"
			});

			expect(resolve1).not.toBe(resolve2);
		});
	});
});

// ────────────────────────────────────────────────────────────────
// Реестр: registerFixedResolver + общий resolveValueState
// ────────────────────────────────────────────────────────────────

describe("реестр фиксированных резолверов", () => {
	describe("registerFixedResolver", () => {
		it("возвращает короткий id с префиксом id_", () => {
			const id = registerFixedResolver({
				entries: { "01": "success", "02": "warning", "03": "error" }
			});

			expect(id).toMatch(/^id_[a-z0-9]+$/);
			expect(id.length).toBeLessThanOrEqual(15);
		});

		it("одинаковые конфигурации возвращают тот же id", () => {
			const id1 = registerFixedResolver({
				entries: { "01": "success", "02": "warning" }
			});
			const id2 = registerFixedResolver({
				entries: { "01": "success", "02": "warning" }
			});

			expect(id1).toBe(id2);
		});

		it("разные конфигурации возвращают разные id", () => {
			const id1 = registerFixedResolver({
				entries: { "01": "success" }
			});
			const id2 = registerFixedResolver({
				entries: { "01": "error" }
			});

			expect(id1).not.toBe(id2);
		});
	});

	describe("resolveValueState с фиксированным резолвером", () => {
		it("применяет зарегистрированный резолвер по id", () => {
			const id = registerFixedResolver({
				entries: { "01": "success", "02": "warning", "03": "error" }
			});

			expect(resolveValueState(id, "01")).toBe("success");
			expect(resolveValueState(id, "02")).toBe("warning");
			expect(resolveValueState(id, "03")).toBe("error");
			expect(resolveValueState(id, "99")).toBe("none");
		});
	});

	describe("взаимодействие register и create", () => {
		it("createFixedResolver и registerFixedResolver разделяют реестр", () => {
			const id = registerFixedResolver({
				entries: { A: "success", B: "error" }
			});

			const resolverFromCreate = createFixedResolver({
				entries: { A: "success", B: "error" }
			});

			const resolverFromRegistry = getValueStateResolver(id);
			expect(resolverFromCreate).toBe(resolverFromRegistry);
		});
	});

	describe("общий реестр с пороговыми резолверами", () => {
		it("фиксированные и пороговые резолверы живут в одном реестре", () => {
			const fixedId = registerFixedResolver({
				entries: { A: "success" }
			});
			const thresholdId = registerThresholdResolver({
				thresholds: [50],
				states: ["warning", "success"]
			});

			const ids = getValueStateResolverIds();
			expect(ids).toContain(fixedId);
			expect(ids).toContain(thresholdId);
			expect(ids).toHaveLength(2);

			// Оба работают через единый resolveValueState
			expect(resolveValueState(fixedId, "A")).toBe("success");
			expect(resolveValueState(thresholdId, 75)).toBe("success");
		});
	});
});

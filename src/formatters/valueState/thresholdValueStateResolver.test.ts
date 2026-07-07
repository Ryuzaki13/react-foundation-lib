import { beforeEach, describe, expect, it } from "vitest";

import { createThresholdResolver, registerThresholdResolver } from "./thresholdValueStateResolver";
import { getValueStateResolver, resetValueStateResolvers, resolveValueState } from "./valueStateRegistry";

beforeEach(() => {
	resetValueStateResolvers();
});

// ────────────────────────────────────────────────────────────────
// createThresholdResolver (прямое использование)
// ────────────────────────────────────────────────────────────────

describe("createThresholdResolver", () => {
	describe("базовые сценарии с двумя порогами", () => {
		const resolve = createThresholdResolver({
			thresholds: [60, 95],
			states: ["warning", "success", "error"]
		});

		it("значение ниже первого порога → первый сегмент", () => {
			expect(resolve(0)).toBe("warning");
			expect(resolve(45)).toBe("warning");
			expect(resolve(59.99)).toBe("warning");
		});

		it("значение между порогами → средний сегмент", () => {
			expect(resolve(60)).toBe("success");
			expect(resolve(75)).toBe("success");
			expect(resolve(94.99)).toBe("success");
		});

		it("значение выше последнего порога → последний сегмент", () => {
			expect(resolve(95)).toBe("error");
			expect(resolve(100)).toBe("error");
			expect(resolve(999)).toBe("error");
		});
	});

	describe("граничные значения с boundary: 'lower'", () => {
		const resolve = createThresholdResolver({
			thresholds: [
				{ value: 60, boundary: "lower" },
				{ value: 95, boundary: "lower" }
			],
			states: ["warning", "success", "error"]
		});

		it("пороговое значение включено в нижний сегмент", () => {
			expect(resolve(60)).toBe("warning");
			expect(resolve(60.01)).toBe("success");
			expect(resolve(95)).toBe("success");
			expect(resolve(95.01)).toBe("error");
		});
	});

	describe("смешанные границы", () => {
		const resolve = createThresholdResolver({
			thresholds: [
				{ value: 60, boundary: "lower" },
				{ value: 95, boundary: "upper" }
			],
			states: ["warning", "success", "error"]
		});

		it("60 включён в нижний, 95 — в верхний сегмент", () => {
			expect(resolve(60)).toBe("warning");
			expect(resolve(60.01)).toBe("success");
			expect(resolve(94.99)).toBe("success");
			expect(resolve(95)).toBe("error");
		});
	});

	describe("один порог", () => {
		const resolve = createThresholdResolver({
			thresholds: [50],
			states: ["error", "success"]
		});

		it("делит ось на два сегмента", () => {
			expect(resolve(49)).toBe("error");
			expect(resolve(50)).toBe("success");
			expect(resolve(51)).toBe("success");
		});
	});

	describe("пустой массив порогов", () => {
		const resolve = createThresholdResolver({
			thresholds: [],
			states: ["success"]
		});

		it("любое валидное значение возвращает единственный State", () => {
			expect(resolve(0)).toBe("success");
			expect(resolve(100)).toBe("success");
			expect(resolve(-999)).toBe("success");
		});
	});

	describe("множественные пороги (4 сегмента)", () => {
		const resolve = createThresholdResolver({
			thresholds: [30, 60, 90],
			states: ["error", "warning", "success", "information"]
		});

		it("корректно распределяет значения по 4 сегментам", () => {
			expect(resolve(10)).toBe("error");
			expect(resolve(30)).toBe("warning");
			expect(resolve(45)).toBe("warning");
			expect(resolve(60)).toBe("success");
			expect(resolve(75)).toBe("success");
			expect(resolve(90)).toBe("information");
			expect(resolve(100)).toBe("information");
		});
	});

	describe("разрыв через 'none'-сегмент", () => {
		const resolve = createThresholdResolver({
			thresholds: [60, 70, 80, 95],
			states: ["warning", "success", "none", "success", "error"]
		});

		it("зона 70–80 возвращает 'none'", () => {
			expect(resolve(50)).toBe("warning");
			expect(resolve(65)).toBe("success");
			expect(resolve(70)).toBe("none");
			expect(resolve(75)).toBe("none");
			expect(resolve(80)).toBe("success");
			expect(resolve(90)).toBe("success");
			expect(resolve(95)).toBe("error");
		});
	});

	describe("невалидные значения", () => {
		const resolve = createThresholdResolver({
			thresholds: [60, 95],
			states: ["warning", "success", "error"]
		});

		it("NaN, Infinity и не-числа возвращают invalidState (по умолчанию 'none')", () => {
			expect(resolve(NaN)).toBe("none");
			expect(resolve(Infinity)).toBe("none");
			expect(resolve(-Infinity)).toBe("none");
			expect(resolve("abc")).toBe("none");
			expect(resolve("")).toBe("none");
			expect(resolve(null)).toBe("none");
			expect(resolve(undefined)).toBe("none");
		});
	});

	describe("пользовательский invalidState", () => {
		const resolve = createThresholdResolver({
			thresholds: [50],
			states: ["warning", "success"],
			invalidState: "error"
		});

		it("невалидные значения возвращают указанный invalidState", () => {
			expect(resolve("abc")).toBe("error");
			expect(resolve(NaN)).toBe("error");
		});
	});

	describe("строковые числовые значения", () => {
		const resolve = createThresholdResolver({
			thresholds: [60, 95],
			states: ["warning", "success", "error"]
		});

		it("строки с числами корректно преобразуются", () => {
			expect(resolve("42")).toBe("warning");
			expect(resolve("60")).toBe("success");
			expect(resolve("60.5")).toBe("success");
			expect(resolve("95")).toBe("error");
			expect(resolve("100")).toBe("error");
		});
	});

	describe("отрицательные значения и пороги", () => {
		const resolve = createThresholdResolver({
			thresholds: [-10, 0, 10],
			states: ["error", "warning", "success", "information"]
		});

		it("корректно работает с отрицательными порогами", () => {
			expect(resolve(-20)).toBe("error");
			expect(resolve(-10)).toBe("warning");
			expect(resolve(-5)).toBe("warning");
			expect(resolve(0)).toBe("success");
			expect(resolve(5)).toBe("success");
			expect(resolve(10)).toBe("information");
			expect(resolve(20)).toBe("information");
		});
	});

	describe("дробные пороги", () => {
		const resolve = createThresholdResolver({
			thresholds: [0.5, 1.5],
			states: ["error", "warning", "success"]
		});

		it("корректно работает с дробными порогами", () => {
			expect(resolve(0.3)).toBe("error");
			expect(resolve(0.5)).toBe("warning");
			expect(resolve(1.0)).toBe("warning");
			expect(resolve(1.5)).toBe("success");
			expect(resolve(2.0)).toBe("success");
		});
	});

	describe("дедупликация", () => {
		it("одинаковые конфигурации возвращают ту же функцию", () => {
			const resolve1 = createThresholdResolver({
				thresholds: [60, 95],
				states: ["warning", "success", "error"]
			});
			const resolve2 = createThresholdResolver({
				thresholds: [60, 95],
				states: ["warning", "success", "error"]
			});

			expect(resolve1).toBe(resolve2);
		});

		it("разные конфигурации возвращают разные функции", () => {
			const resolve1 = createThresholdResolver({
				thresholds: [60, 95],
				states: ["warning", "success", "error"]
			});
			const resolve2 = createThresholdResolver({
				thresholds: [50, 90],
				states: ["warning", "success", "error"]
			});

			expect(resolve1).not.toBe(resolve2);
		});

		it("конфигурации с разными boundary — разные функции", () => {
			const resolve1 = createThresholdResolver({
				thresholds: [60],
				states: ["warning", "success"]
			});
			const resolve2 = createThresholdResolver({
				thresholds: [{ value: 60, boundary: "lower" }],
				states: ["warning", "success"]
			});

			expect(resolve1).not.toBe(resolve2);
		});

		it("неотсортированные пороги нормализуются и дедуплицируются", () => {
			const resolve1 = createThresholdResolver({
				thresholds: [95, 60],
				states: ["warning", "success", "error"]
			});
			const resolve2 = createThresholdResolver({
				thresholds: [60, 95],
				states: ["warning", "success", "error"]
			});

			expect(resolve1).toBe(resolve2);
		});
	});

	describe("валидация конфигурации", () => {
		it("выбрасывает ошибку при неправильном количестве состояний", () => {
			expect(() =>
				createThresholdResolver({
					thresholds: [60, 95],
					states: ["warning", "success"]
				})
			).toThrow("Количество состояний (2) должно быть равно количеству порогов + 1 (3)");
		});

		it("выбрасывает ошибку при слишком большом количестве состояний", () => {
			expect(() =>
				createThresholdResolver({
					thresholds: [60],
					states: ["warning", "success", "error"]
				})
			).toThrow("Количество состояний (3) должно быть равно количеству порогов + 1 (2)");
		});
	});

	describe("автосортировка порогов", () => {
		it("пороги в произвольном порядке сортируются автоматически", () => {
			const resolve = createThresholdResolver({
				thresholds: [95, 60],
				states: ["warning", "success", "error"]
			});

			expect(resolve(50)).toBe("warning");
			expect(resolve(75)).toBe("success");
			expect(resolve(100)).toBe("error");
		});
	});
});

// ────────────────────────────────────────────────────────────────
// Реестр: registerThresholdResolver + общий resolveValueState
// ────────────────────────────────────────────────────────────────

describe("реестр пороговых резолверов", () => {
	describe("registerThresholdResolver", () => {
		it("возвращает короткий id с префиксом id_", () => {
			const id = registerThresholdResolver({
				thresholds: [60, 95],
				states: ["warning", "success", "error"]
			});

			expect(id).toMatch(/^id_[a-z0-9]+$/);
			expect(id.length).toBeLessThanOrEqual(15);
		});

		it("одинаковые конфигурации возвращают тот же id", () => {
			const id1 = registerThresholdResolver({
				thresholds: [60, 95],
				states: ["warning", "success", "error"]
			});
			const id2 = registerThresholdResolver({
				thresholds: [60, 95],
				states: ["warning", "success", "error"]
			});

			expect(id1).toBe(id2);
		});

		it("разные конфигурации возвращают разные id", () => {
			const id1 = registerThresholdResolver({
				thresholds: [60, 95],
				states: ["warning", "success", "error"]
			});
			const id2 = registerThresholdResolver({
				thresholds: [50, 90],
				states: ["warning", "success", "error"]
			});

			expect(id1).not.toBe(id2);
		});
	});

	describe("resolveValueState с пороговым резолвером", () => {
		it("применяет зарегистрированный резолвер по id", () => {
			const id = registerThresholdResolver({
				thresholds: [60, 95],
				states: ["warning", "success", "error"]
			});

			expect(resolveValueState(id, 45)).toBe("warning");
			expect(resolveValueState(id, 75)).toBe("success");
			expect(resolveValueState(id, 100)).toBe("error");
		});

		it("возвращает 'none' для несуществующего id", () => {
			expect(resolveValueState("nonexistent", 42)).toBe("none");
		});
	});

	describe("взаимодействие register и create", () => {
		it("createThresholdResolver и registerThresholdResolver разделяют реестр", () => {
			const id = registerThresholdResolver({
				thresholds: [60, 95],
				states: ["warning", "success", "error"]
			});

			const resolverFromCreate = createThresholdResolver({
				thresholds: [60, 95],
				states: ["warning", "success", "error"]
			});

			const resolverFromRegistry = getValueStateResolver(id);
			expect(resolverFromCreate).toBe(resolverFromRegistry);
		});
	});
});

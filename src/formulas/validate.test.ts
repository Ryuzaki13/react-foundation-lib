import { describe, expect, it } from "vitest";

import { validateTableFormulaDependencies } from "./validate";

describe("validateTableFormulaDependenciesV2", () => {
	it("возвращает ok для корректной конфигурации markup", () => {
		const result = validateTableFormulaDependencies({
			formulaId: "markup",
			dependencies: ["MP_BC", "NETWR"],
			availableColumnIds: ["MP_BC", "NETWR", "QTY"]
		});

		expect(result.ok).toBe(true);
		expect(result.errors).toEqual([]);
		expect(result.usage.requiredDependencyCount).toBe(2);
	});

	it("возвращает ошибку, если зависимостей меньше, чем запрашивает формула", () => {
		const result = validateTableFormulaDependencies({
			formulaId: "markup",
			dependencies: ["MP_BC"],
			availableColumnIds: ["MP_BC", "NETWR"]
		});

		expect(result.ok).toBe(false);
		expect(result.errors.some((item) => item.code === "dependency_index_out_of_range")).toBe(true);
	});

	it("возвращает warning для неиспользуемых зависимостей", () => {
		const result = validateTableFormulaDependencies({
			formulaId: "markup",
			dependencies: ["MP_BC", "NETWR", "QTY"],
			availableColumnIds: ["MP_BC", "NETWR", "QTY"]
		});

		expect(result.ok).toBe(true);
		expect(result.warnings.some((item) => item.code === "unused_dependencies")).toBe(true);
	});

	it("возвращает ошибку, если зависимость не входит в доступные колонки", () => {
		const result = validateTableFormulaDependencies({
			formulaId: "markup",
			dependencies: ["MP_BC", "TEXT_MISSING_FIELD"],
			availableColumnIds: ["MP_BC", "NETWR"]
		});

		expect(result.ok).toBe(false);
		expect(result.errors.some((item) => item.code === "dependency_not_available")).toBe(true);
	});

	it("возвращает ошибку, если формула не найдена", () => {
		const result = validateTableFormulaDependencies({
			formulaId: "unknown",
			dependencies: ["A"],
			availableColumnIds: ["A"]
		});

		expect(result.ok).toBe(false);
		expect(result.errors.some((item) => item.code === "formula_not_found")).toBe(true);
	});
});

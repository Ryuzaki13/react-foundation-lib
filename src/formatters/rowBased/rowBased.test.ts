import { describe, expect, it, vi } from "vitest";

import { createRowBasedFormatterContext } from "./context";
import { createRowBasedFormatterRegistry, getRowBasedFormatterById, getRowBasedFormatterList } from "./registry";

describe("rowBased formatter context", () => {
	it("читает ключи, raw values и числовые значения по индексу", () => {
		const onReadIndex = vi.fn();
		const onOutOfRangeIndex = vi.fn();
		const context = createRowBasedFormatterContext({
			rowData: { A: "10,5", B: "text" },
			rawValue: "raw",
			columnId: "A",
			keys: ["A", "B"],
			instrumentation: { onReadIndex, onOutOfRangeIndex }
		});

		expect(context.key(0)).toBe("A");
		expect(context.value(1)).toBe("text");
		expect(context.num(0)).toBe(10.5);
		expect(context.num(1)).toBe(0);
		expect(context.value(3)).toBeUndefined();
		expect(context.key(-1)).toBeUndefined();
		expect(onReadIndex).toHaveBeenCalledWith(0);
		expect(onOutOfRangeIndex).toHaveBeenCalledWith(3);
		expect(onOutOfRangeIndex).toHaveBeenCalledWith(-1);
	});
});

describe("rowBased formatter registry", () => {
	it("нормализует id/name/description и замораживает список", () => {
		const registry = createRowBasedFormatterRegistry([
			{
				id: " formula ",
				name: " Название ",
				description: " Описание ",
				fn: ({ value }) => String(value(0))
			}
		]);

		expect(registry.list[0]).toMatchObject({
			id: "formula",
			name: "Название",
			description: "Описание"
		});
		expect(registry.byId.get("formula")).toBe(registry.list[0]);
		expect(Object.isFrozen(registry.list)).toBe(true);
		expect(Object.isFrozen(registry.list[0])).toBe(true);
	});

	it("отклоняет пустые и дублирующиеся id", () => {
		expect(() => createRowBasedFormatterRegistry([{ id: " ", name: "A", description: "", fn: () => "" }])).toThrow(
			"не может быть пустым"
		);
		expect(() =>
			createRowBasedFormatterRegistry([
				{ id: "formula", name: "A", description: "", fn: () => "" },
				{ id: " formula ", name: "B", description: "", fn: () => "" }
			])
		).toThrow("дублирующийся");
	});

	it("читает глобальный registry по trimmed id", () => {
		expect(getRowBasedFormatterList().length).toBeGreaterThan(0);
		const first = getRowBasedFormatterList()[0];

		expect(getRowBasedFormatterById(` ${first?.id} `)).toBe(first);
		expect(getRowBasedFormatterById(" ")).toBeUndefined();
		expect(getRowBasedFormatterById(undefined)).toBeUndefined();
	});
});

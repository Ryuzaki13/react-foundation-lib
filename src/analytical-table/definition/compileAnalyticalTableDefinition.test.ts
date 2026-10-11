import { describe, expect, it } from "vitest";

import { compileAnalyticalTableDefinition, createAnalyticalTableRuntime } from "../index";

describe("подготовленное описание аналитической таблицы", () => {
	it("проверяет единый каталог видимых и служебных полей до получения данных", () => {
		expect(() => compileAnalyticalTableDefinition({ columns: [{ id: "same" }], dataFields: [{ id: "same" }] })).toThrow("уникальны");
		expect(() =>
			compileAnalyticalTableDefinition({
				columns: [{ id: "result", calculate: { dependencies: ["missing"], compute: () => 1 } }]
			})
		).toThrow("Неизвестная зависимость");
	});

	it("служебное поле доступно фильтру и сортировке без появления в выходных columns", () => {
		const columns = [{ id: "label" }];
		const definition = compileAnalyticalTableDefinition({ columns, dataFields: [{ id: "rank" }] });
		const runtime = createAnalyticalTableRuntime({
			definition,
			snapshot: {
				rows: [
					{ id: "b", values: { label: "Б", rank: 2 } },
					{ id: "a", values: { label: "А", rank: 1 } }
				]
			}
		});

		expect(runtime.getModel({ sorting: [{ id: "rank" }] }).rows.map((row) => row.id)).toEqual(["a", "b"]);
		const filtered = runtime.getModel({ filters: [{ id: "rank", value: 1 }] });
		expect(filtered.rows.map((row) => row.id)).toEqual(["a"]);
		expect(filtered.columns).toBe(columns);
	});
});

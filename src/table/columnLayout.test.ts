import { describe, expect, it } from "vitest";

import { buildTableColumnLayout, resolveTableColumnOrder } from "./columnLayout";

describe("table column layout helpers", () => {
	it("строит порядок из сохранённого order и добавляет новые id в конец", () => {
		expect(resolveTableColumnOrder({ ids: ["A", "B", "C", "D"], order: ["D", "B", "UNKNOWN", "B"] })).toEqual(["D", "B", "A", "C"]);
	});

	it("оставляет ширины привязанными к id после изменения порядка", () => {
		const order = resolveTableColumnOrder({
			ids: ["A", "B", "C", "D", "E"],
			order: ["A", "D", "C", "B", "E"]
		});
		const widths: Record<string, number> = {
			A: 100,
			B: 200,
			C: 100,
			D: 50,
			E: 100
		};
		const layout = buildTableColumnLayout({
			ids: order,
			getWidth: (id) => widths[id] ?? 0
		});

		expect(layout).toEqual([
			{ id: "A", width: 100 },
			{ id: "D", width: 50 },
			{ id: "C", width: 100 },
			{ id: "B", width: 200 },
			{ id: "E", width: 100 }
		]);
	});
});

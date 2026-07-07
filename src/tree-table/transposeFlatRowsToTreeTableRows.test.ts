import { describe, expect, it } from "vitest";

import { transposeFlatRowsToTreeTableRows } from "./transposeFlatRowsToTreeTableRows";
import {
	TREE_TABLE_TRANSPOSED_LABEL_FIELD,
	TREE_TABLE_TRANSPOSED_PARENT_ROW_ID_FIELD,
	TREE_TABLE_TRANSPOSED_ROW_ID_FIELD,
	TREE_TABLE_TRANSPOSED_SYNTHETIC_FIELD
} from "./types";

type DemoRow = {
	ZDIV: string;
	ZCFO1: string;
	AMOUNT: number;
};

describe("transposeFlatRowsToTreeTableRows", () => {
	it("создает синтетические group-узлы и оставляет backend-строки листьями", () => {
		const rows = transposeFlatRowsToTreeTableRows<DemoRow>(
			[
				{ ZDIV: "D1", ZCFO1: "F1", AMOUNT: 10 },
				{ ZDIV: "D1", ZCFO1: "F2", AMOUNT: 20 },
				{ ZDIV: "D2", ZCFO1: "F3", AMOUNT: 30 }
			],
			{ hierarchyLevels: [{ columnId: "ZDIV" }, { columnId: "ZCFO1" }] }
		);

		expect(rows.map((row) => row[TREE_TABLE_TRANSPOSED_LABEL_FIELD])).toEqual(["D1", "F1", "F1", "F2", "F2", "D2", "F3", "F3"]);
		expect(rows.map((row) => row[TREE_TABLE_TRANSPOSED_SYNTHETIC_FIELD])).toEqual([true, true, false, true, false, true, true, false]);
		expect(rows[2]?.AMOUNT).toBe(10);
		expect(rows[2]?.ZDIV).toBe("D1");
		expect(rows[2]?.ZCFO1).toBe("F1");
		expect(rows[1]?.[TREE_TABLE_TRANSPOSED_PARENT_ROW_ID_FIELD]).toBe(rows[0]?.[TREE_TABLE_TRANSPOSED_ROW_ID_FIELD]);
		expect(rows[2]?.[TREE_TABLE_TRANSPOSED_PARENT_ROW_ID_FIELD]).toBe(rows[1]?.[TREE_TABLE_TRANSPOSED_ROW_ID_FIELD]);
	});

	it("не дублирует одинаковые group-узлы", () => {
		const rows = transposeFlatRowsToTreeTableRows<DemoRow>(
			[
				{ ZDIV: "D1", ZCFO1: "F1", AMOUNT: 10 },
				{ ZDIV: "D1", ZCFO1: "F1", AMOUNT: 20 }
			],
			{ hierarchyLevels: [{ columnId: "ZDIV" }, { columnId: "ZCFO1" }] }
		);

		expect(rows.filter((row) => row[TREE_TABLE_TRANSPOSED_SYNTHETIC_FIELD])).toHaveLength(2);
		expect(rows.filter((row) => !row[TREE_TABLE_TRANSPOSED_SYNTHETIC_FIELD])).toHaveLength(2);
	});

	it("всегда создает общий group-узел последнего уровня", () => {
		const rows = transposeFlatRowsToTreeTableRows<DemoRow>(
			[
				{ ZDIV: "D1", ZCFO1: "F1", AMOUNT: 10 },
				{ ZDIV: "D1", ZCFO1: "F1", AMOUNT: 20 }
			],
			{
				hierarchyLevels: [{ columnId: "ZDIV" }, { columnId: "ZCFO1" }]
			}
		);

		expect(rows.map((row) => row[TREE_TABLE_TRANSPOSED_LABEL_FIELD])).toEqual(["D1", "F1", "F1", "F1"]);
		expect(rows.map((row) => row[TREE_TABLE_TRANSPOSED_SYNTHETIC_FIELD])).toEqual([true, true, false, false]);
		expect(rows[2]?.[TREE_TABLE_TRANSPOSED_PARENT_ROW_ID_FIELD]).toBe(rows[1]?.[TREE_TABLE_TRANSPOSED_ROW_ID_FIELD]);
		expect(rows[3]?.[TREE_TABLE_TRANSPOSED_PARENT_ROW_ID_FIELD]).toBe(rows[1]?.[TREE_TABLE_TRANSPOSED_ROW_ID_FIELD]);
	});
});

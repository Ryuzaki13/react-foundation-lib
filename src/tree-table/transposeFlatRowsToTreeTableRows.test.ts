import { describe, expect, it } from "vitest";

import { transposeFlatRowsToTreeTableRows } from "./transposeFlatRowsToTreeTableRows";
import {
	TREE_TABLE_TRANSPOSED_LABEL_FIELD,
	TREE_TABLE_TRANSPOSED_PARENT_ROW_ID_FIELD,
	TREE_TABLE_TRANSPOSED_ROW_ID_FIELD,
	TREE_TABLE_TRANSPOSED_SYNTHETIC_FIELD
} from "./types";

type DemoRow = {
	TEXT_DIVISION: string;
	TEXT_NODE: string;
	AMOUNT: number;
};

describe("transposeFlatRowsToTreeTableRows", () => {
	it("создает синтетические group-узлы и оставляет backend-строки листьями", () => {
		const rows = transposeFlatRowsToTreeTableRows<DemoRow>(
			[
				{ TEXT_DIVISION: "D1", TEXT_NODE: "F1", AMOUNT: 10 },
				{ TEXT_DIVISION: "D1", TEXT_NODE: "F2", AMOUNT: 20 },
				{ TEXT_DIVISION: "D2", TEXT_NODE: "F3", AMOUNT: 30 }
			],
			{ hierarchyLevels: [{ columnId: "TEXT_DIVISION" }, { columnId: "TEXT_NODE" }] }
		);

		expect(rows.map((row) => row[TREE_TABLE_TRANSPOSED_LABEL_FIELD])).toEqual(["D1", "F1", "F1", "F2", "F2", "D2", "F3", "F3"]);
		expect(rows.map((row) => row[TREE_TABLE_TRANSPOSED_SYNTHETIC_FIELD])).toEqual([true, true, false, true, false, true, true, false]);
		expect(rows[2]?.AMOUNT).toBe(10);
		expect(rows[2]?.TEXT_DIVISION).toBe("D1");
		expect(rows[2]?.TEXT_NODE).toBe("F1");
		expect(rows[1]?.[TREE_TABLE_TRANSPOSED_PARENT_ROW_ID_FIELD]).toBe(rows[0]?.[TREE_TABLE_TRANSPOSED_ROW_ID_FIELD]);
		expect(rows[2]?.[TREE_TABLE_TRANSPOSED_PARENT_ROW_ID_FIELD]).toBe(rows[1]?.[TREE_TABLE_TRANSPOSED_ROW_ID_FIELD]);
	});

	it("не дублирует одинаковые group-узлы", () => {
		const rows = transposeFlatRowsToTreeTableRows<DemoRow>(
			[
				{ TEXT_DIVISION: "D1", TEXT_NODE: "F1", AMOUNT: 10 },
				{ TEXT_DIVISION: "D1", TEXT_NODE: "F1", AMOUNT: 20 }
			],
			{ hierarchyLevels: [{ columnId: "TEXT_DIVISION" }, { columnId: "TEXT_NODE" }] }
		);

		expect(rows.filter((row) => row[TREE_TABLE_TRANSPOSED_SYNTHETIC_FIELD])).toHaveLength(2);
		expect(rows.filter((row) => !row[TREE_TABLE_TRANSPOSED_SYNTHETIC_FIELD])).toHaveLength(2);
	});

	it("всегда создает общий group-узел последнего уровня", () => {
		const rows = transposeFlatRowsToTreeTableRows<DemoRow>(
			[
				{ TEXT_DIVISION: "D1", TEXT_NODE: "F1", AMOUNT: 10 },
				{ TEXT_DIVISION: "D1", TEXT_NODE: "F1", AMOUNT: 20 }
			],
			{
				hierarchyLevels: [{ columnId: "TEXT_DIVISION" }, { columnId: "TEXT_NODE" }]
			}
		);

		expect(rows.map((row) => row[TREE_TABLE_TRANSPOSED_LABEL_FIELD])).toEqual(["D1", "F1", "F1", "F1"]);
		expect(rows.map((row) => row[TREE_TABLE_TRANSPOSED_SYNTHETIC_FIELD])).toEqual([true, true, false, false]);
		expect(rows[2]?.[TREE_TABLE_TRANSPOSED_PARENT_ROW_ID_FIELD]).toBe(rows[1]?.[TREE_TABLE_TRANSPOSED_ROW_ID_FIELD]);
		expect(rows[3]?.[TREE_TABLE_TRANSPOSED_PARENT_ROW_ID_FIELD]).toBe(rows[1]?.[TREE_TABLE_TRANSPOSED_ROW_ID_FIELD]);
	});
});

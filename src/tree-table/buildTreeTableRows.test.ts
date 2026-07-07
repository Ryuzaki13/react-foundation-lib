import { describe, expect, it } from "vitest";

import { buildTreeTableRows } from "./buildTreeTableRows";

interface DemoRow {
	id: string;
	parentId: string | null;
	title: string;
}

const hierarchy = {
	getRowId: (row: DemoRow) => row.id,
	getParentRowId: (row: DemoRow) => row.parentId
};

describe("buildTreeTableRows", () => {
	it("собирает дерево из плоского списка и сохраняет исходный порядок детей", () => {
		const result = buildTreeTableRows(
			[
				{ id: "child-1", parentId: "root", title: "Дочерний узел" },
				{ id: "root", parentId: null, title: "Корень" },
				{ id: "grandchild-1", parentId: "child-1", title: "Внук" }
			],
			hierarchy
		);

		expect(result.rootRowIds).toEqual(["root"]);
		expect(result.rows).toEqual([
			{
				id: "root",
				parentId: null,
				title: "Корень",
				children: [
					{
						id: "child-1",
						parentId: "root",
						title: "Дочерний узел",
						children: [{ id: "grandchild-1", parentId: "child-1", title: "Внук" }]
					}
				]
			}
		]);
	});

	it("поднимает сироту в корень и фиксирует её идентификатор", () => {
		const result = buildTreeTableRows(
			[
				{ id: "root", parentId: null, title: "Корень" },
				{ id: "orphan", parentId: "missing", title: "Сирота" }
			],
			hierarchy
		);

		expect(result.rootRowIds).toEqual(["root", "orphan"]);
		expect(result.orphanRowIds).toEqual(["orphan"]);
		expect(result.rows[1]).toEqual({ id: "orphan", parentId: "missing", title: "Сирота" });
	});

	it("не зацикливается на циклических ссылках и выводит компонент цикла как отдельный корень", () => {
		const result = buildTreeTableRows(
			[
				{ id: "a", parentId: "b", title: "A" },
				{ id: "b", parentId: "a", title: "B" }
			],
			hierarchy
		);

		expect(result.rootRowIds).toEqual(["a"]);
		expect(result.cyclicRowIds).toEqual(["a"]);
		expect(result.rows).toEqual([
			{
				id: "a",
				parentId: "b",
				title: "A",
				children: [{ id: "b", parentId: "a", title: "B" }]
			}
		]);
	});

	it("игнорирует повторяющиеся идентификаторы после первого вхождения", () => {
		const result = buildTreeTableRows(
			[
				{ id: "root", parentId: null, title: "Первый корень" },
				{ id: "root", parentId: null, title: "Повтор" }
			],
			hierarchy
		);

		expect(result.duplicateRowIds).toEqual(["root"]);
		expect(result.rows).toEqual([{ id: "root", parentId: null, title: "Первый корень" }]);
	});
});

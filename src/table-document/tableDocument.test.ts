import { describe, expect, it } from "vitest";

import {
	assertTableDocument,
	deleteTableDocumentAxisGroup,
	expandTableDocumentRange,
	getTableDocumentAxisGroups,
	getTableDocumentCellRange,
	insertTableDocumentAxis,
	mergeTableDocumentCells,
	moveTableDocumentAxisGroup,
	splitTableDocumentCell,
	updateTableDocumentCell,
	type TableDocument
} from "./index";

/** Самодостаточные фикстуры: тесты не импортируют исходники приложений или legacy. */
function fixture(height = 4, width = 4): TableDocument<string> {
	return {
		version: 1,
		caption: "Таблица",
		columns: Array.from({ length: width }, (_, c) => ({ id: `column-${c}`, width: null })),
		rows: Array.from({ length: height }, (_, r) => ({
			id: `row-${r}`,
			cells: Array.from({ length: width }, (_, c) => ({ id: `cell-${r}-${c}`, value: `${r}:${c}` }))
		})),
		merges: [],
		headerRowCount: 0,
		hideHeaders: false,
		showRowNumbers: false
	};
}
const at = (row: number, column: number) => ({ row, column });

describe("документ таблицы", () => {
	it("merge сохраняет все значения и исходную матрицу по ссылке", () => {
		const original = fixture();
		const snapshot = JSON.stringify(original);
		const merged = mergeTableDocumentCells(original, at(0, 0), at(1, 2));
		expect(merged.rows).toBe(original.rows);
		expect(merged.merges).toEqual([{ row: 0, column: 0, rowSpan: 2, columnSpan: 3 }]);
		expect(JSON.stringify(original)).toBe(snapshot);
		expect(mergeTableDocumentCells(merged, at(1, 2), at(0, 0))).toBe(merged);
	});
	it("регрессия legacy: B1:C1 → A1:C1 → split не оставляет вложенный span", () => {
		const original = fixture(1, 3);
		const first = mergeTableDocumentCells(original, at(0, 1), at(0, 2));
		const second = mergeTableDocumentCells(first, at(0, 0), at(0, 2));
		const split = splitTableDocumentCell(second, at(0, 1));
		expect(split).toEqual(original);
		expect(split.rows).toBe(original.rows);
	});
	it("регрессия legacy: цепочка объединений расширяет выделение до неподвижной точки", () => {
		let document = mergeTableDocumentCells(fixture(2, 3), at(0, 0), at(1, 0));
		document = mergeTableDocumentCells(document, at(1, 1), at(1, 2));
		expect(expandTableDocumentRange(document, at(0, 0), at(0, 1))).toEqual({ row: 0, column: 0, rowSpan: 2, columnSpan: 3 });
		expect(expandTableDocumentRange({ ...document, merges: [...document.merges].reverse() }, at(0, 0), at(0, 1))).toEqual({
			row: 0,
			column: 0,
			rowSpan: 2,
			columnSpan: 3
		});
	});
	it("находит anchor покрытой ячейки и не меняет обычную при split", () => {
		const document = mergeTableDocumentCells(fixture(), at(1, 1), at(2, 3));
		expect(getTableDocumentCellRange(document, at(2, 2))).toEqual({ row: 1, column: 1, rowSpan: 2, columnSpan: 3 });
		expect(splitTableDocumentCell(document, at(0, 0))).toBe(document);
	});
	it.each(["row", "column"] as const)("вставка %s внутрь merge расширяет геометрию и сохраняет значения", (axis) => {
		const document = mergeTableDocumentCells(fixture(), at(0, 0), at(2, 2));
		const inserted = insertTableDocumentAxis(
			document,
			axis,
			1,
			"new-axis",
			Array.from({ length: 4 }, (_, i) => ({ id: `new-${i}`, value: "" }))
		);
		expect(inserted.merges[0][axis === "row" ? "rowSpan" : "columnSpan"]).toBe(4);
		expect(() => assertTableDocument(inserted)).not.toThrow();
		expect(document.rows.flatMap((row) => row.cells).every((cell) => inserted.rows.flatMap((row) => row.cells).includes(cell))).toBe(
			true
		);
	});
	it.each([0, 3, 4])("вставка на границе %i не захватывает новую строку объединением", (index) => {
		const document = mergeTableDocumentCells(fixture(), at(0, 0), at(2, 2));
		const inserted = insertTableDocumentAxis(
			document,
			"row",
			index,
			"new-row",
			Array.from({ length: 4 }, (_, i) => ({ id: `new-${i}`, value: "" }))
		);
		expect(inserted.merges[0].rowSpan).toBe(3);
	});
	it("заголовок не объединяется и не перемещается через границу body", () => {
		const document = { ...fixture(), headerRowCount: 1 };
		expect(() => mergeTableDocumentCells(document, at(0, 0), at(1, 0))).toThrow(/заголовок/);
		expect(moveTableDocumentAxisGroup(document, "row", 0, 1)).toBe(document);
		expect(moveTableDocumentAxisGroup(document, "row", 1, -1)).toBe(document);
		expect(() => insertTableDocumentAxis(document, "row", 0, "new", [], "body")).toThrow();
	});
	it("вставка строки заголовка изменяет только соответствующий счётчик", () => {
		const document = { ...fixture(), headerRowCount: 1 };
		const cells = Array.from({ length: 4 }, (_, i) => ({ id: `new-${i}`, value: "" }));
		expect(insertTableDocumentAxis(document, "row", 1, "new", cells, "header").headerRowCount).toBe(2);
		expect(insertTableDocumentAxis(document, "row", 1, "new", cells, "body").headerRowCount).toBe(1);
	});
	it.each(["row", "column"] as const)("перемещение и удаление %s учитывают целую группу", (axis) => {
		const document = mergeTableDocumentCells(fixture(), at(0, 0), at(1, 1));
		expect(getTableDocumentAxisGroups(document, axis)).toEqual([
			{ start: 0, count: 2 },
			{ start: 2, count: 1 },
			{ start: 3, count: 1 }
		]);
		const moved = moveTableDocumentAxisGroup(document, axis, 1, 1);
		expect(moved.merges[0][axis]).toBe(1);
		expect(moveTableDocumentAxisGroup(moved, axis, 1, -1)).toEqual(document);
		const deleted = deleteTableDocumentAxisGroup(document, axis, 1);
		expect(axis === "row" ? deleted.rows.length : deleted.columns.length).toBe(2);
		expect(deleted.merges).toEqual([]);
		expect(() => assertTableDocument(deleted)).not.toThrow();
	});
	it("размер и непересечение проверяются до изменения", () => {
		expect(() => assertTableDocument(fixture(0, 2))).toThrow();
		expect(() =>
			assertTableDocument({
				...fixture(),
				merges: [
					{ row: 0, column: 0, rowSpan: 2, columnSpan: 2 },
					{ row: 1, column: 1, rowSpan: 2, columnSpan: 2 }
				]
			})
		).toThrow(/пересекаются/);
		expect(() => mergeTableDocumentCells(fixture(), at(-1, 0), at(1, 1))).toThrow();
		expect(() => deleteTableDocumentAxisGroup(fixture(1, 1), "row", 0)).toThrow();
	});
	it("ссылки и другие типы значений не преобразуются при изменении ячейки", () => {
		const document = fixture();
		const updated = updateTableDocumentCell(document, at(1, 1), "Новый текст");
		expect(updated.rows[0]).toBe(document.rows[0]);
		expect(updated.rows[1].cells[1].id).toBe(document.rows[1].cells[1].id);
		expect(document.rows[1].cells[1].value).toBe("1:1");
		expect(updateTableDocumentCell(updated, at(1, 1), "Новый текст")).toBe(updated);
	});
	it("все прямоугольники сетки 4×4 проходят merge/split без потерь", () => {
		const document = fixture();
		for (let r = 0; r < 4; r++)
			for (let c = 0; c < 4; c++)
				for (let bottom = r; bottom < 4; bottom++)
					for (let right = c; right < 4; right++) {
						const merged = mergeTableDocumentCells(document, at(r, c), at(bottom, right));
						expect(() => assertTableDocument(merged)).not.toThrow();
						expect(splitTableDocumentCell(merged, at(bottom, right))).toEqual(document);
					}
	});
});

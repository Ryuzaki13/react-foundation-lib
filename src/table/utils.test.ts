// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { getTableColumnFormattingMeta, getTableColumnMeta, isTableInteractiveElement, resolveTableLength } from "./utils";

import type { TableColumnDef } from "./types";

type DemoRow = {
	id: string;
	parentId?: string | null;
	amount: number;
	status: string;
};

/**
 * Проверяет helper-утилиты для чтения `meta` и даёт compile-time smoke
 * для нового контракта `meta.formatting` у Table/TreeTable колонок.
 */
describe("table utils", () => {
	it("возвращает undefined, если meta.formatting не задан", () => {
		const column: TableColumnDef<DemoRow> = {
			id: "status",
			accessorKey: "status",
			header: "Статус",
			meta: {
				width: 10,
				align: "left"
			}
		};

		expect(getTableColumnFormattingMeta(column)).toBeUndefined();
		expect(getTableColumnMeta(column)).toEqual({
			width: 10,
			align: "left"
		});
	});

	it("возвращает formatting, не теряя width и align", () => {
		const column: TableColumnDef<DemoRow> = {
			id: "amount",
			accessorKey: "amount",
			header: "Сумма",
			meta: {
				width: 12,
				align: "right",
				formatting: {
					role: "measure",
					type: "decimal",
					formulaId: "markup",
					formulaDependencies: ["BASE", "TOTAL"],
					formattersPipeline: {
						version: 1,
						plan: {
							steps: []
						}
					},
					purelyDerived: true,
					emptyWhenZero: true,
					overflowTooltip: true
				}
			}
		};

		expect(getTableColumnMeta(column)).toEqual({
			width: 12,
			align: "right",
			formatting: {
				role: "measure",
				type: "decimal",
				formulaId: "markup",
				formulaDependencies: ["BASE", "TOTAL"],
				formattersPipeline: {
					version: 1,
					plan: {
						steps: []
					}
				},
				purelyDerived: true,
				emptyWhenZero: true,
				overflowTooltip: true
			}
		});
		expect(getTableColumnFormattingMeta(column)).toEqual({
			role: "measure",
			type: "decimal",
			formulaId: "markup",
			formulaDependencies: ["BASE", "TOTAL"],
			formattersPipeline: {
				version: 1,
				plan: {
					steps: []
				}
			},
			purelyDerived: true,
			emptyWhenZero: true,
			overflowTooltip: true
		});
	});

	it("нормализует числовую длину таблицы в em и сохраняет CSS-строки", () => {
		expect(resolveTableLength(12)).toBe("12em");
		expect(resolveTableLength("50%")).toBe("50%");
		expect(resolveTableLength("auto")).toBe("auto");
	});

	it("распознаёт клики из интерактивных элементов таблицы", () => {
		const button = document.createElement("button");
		const link = document.createElement("a");
		const switchControl = document.createElement("span");
		const editable = document.createElement("div");
		const focusable = document.createElement("div");
		const summary = document.createElement("summary");
		const iconButton = document.createElement("button");
		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		const svgPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
		const wrapper = document.createElement("div");
		const custom = document.createElement("span");
		const selectableCell = document.createElement("td");
		const cellText = document.createElement("span");

		switchControl.setAttribute("role", "switch");
		editable.setAttribute("contenteditable", "true");
		focusable.tabIndex = -1;
		svg.append(svgPath);
		iconButton.append(svg);
		wrapper.dataset.rowAction = "true";
		wrapper.append(custom);
		selectableCell.tabIndex = 0;
		selectableCell.append(cellText);

		expect(isTableInteractiveElement(button)).toBe(true);
		expect(isTableInteractiveElement(link)).toBe(true);
		expect(isTableInteractiveElement(switchControl)).toBe(true);
		expect(isTableInteractiveElement(editable)).toBe(true);
		expect(isTableInteractiveElement(focusable)).toBe(true);
		expect(isTableInteractiveElement(summary)).toBe(true);
		expect(isTableInteractiveElement(svgPath)).toBe(true);
		expect(isTableInteractiveElement(custom, "[data-row-action='true']")).toBe(true);
		expect(isTableInteractiveElement(cellText)).toBe(false);
		expect(isTableInteractiveElement(document.createElement("span"))).toBe(false);
		expect(isTableInteractiveElement(null)).toBe(false);
	});
});

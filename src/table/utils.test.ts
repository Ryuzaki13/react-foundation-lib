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
		const wrapper = document.createElement("div");
		const custom = document.createElement("span");

		wrapper.dataset.rowAction = "true";
		wrapper.append(custom);

		expect(isTableInteractiveElement(button)).toBe(true);
		expect(isTableInteractiveElement(link)).toBe(true);
		expect(isTableInteractiveElement(custom, "[data-row-action='true']")).toBe(true);
		expect(isTableInteractiveElement(document.createElement("span"))).toBe(false);
		expect(isTableInteractiveElement(null)).toBe(false);
	});
});

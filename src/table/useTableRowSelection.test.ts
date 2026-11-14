// @vitest-environment jsdom

import { act, createElement, useLayoutEffect } from "react";

import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type TableSelectionMode } from "./types";
import { useTableRowSelection } from "./useTableRowSelection";

type Row = { id: string };
type Selection = ReturnType<typeof useTableRowSelection<Row>>;

const firstRow = { id: "first" };
const secondRow = { id: "second" };
const allRows = [firstRow, secondRow];

function SelectionProbe({
	rows,
	mode,
	selectedRowIds,
	onSelectionChange,
	onCommit
}: {
	rows: readonly Row[];
	mode: TableSelectionMode;
	selectedRowIds?: readonly string[];
	onSelectionChange: (rows: Row[]) => void;
	onCommit: (selection: Selection) => void;
}) {
	const selection = useTableRowSelection({
		availableRowIds: rows.map(({ id }) => id),
		rowById: new Map(rows.map((row) => [row.id, row])),
		selectionMode: mode,
		selectedRowIds: selectedRowIds && [...selectedRowIds],
		onRowSelectionChange: onSelectionChange
	});

	useLayoutEffect(() => {
		onCommit(selection);
	});

	return null;
}

describe("useTableRowSelection", () => {
	let root: Root;
	const onSelectionChange = vi.fn<(rows: Row[]) => void>();
	const onCommit = vi.fn<(selection: Selection) => void>();

	function render(rows: readonly Row[], mode: TableSelectionMode = "multi", selectedRowIds?: readonly string[]) {
		onCommit.mockClear();
		act(() => root.render(createElement(SelectionProbe, { rows, mode, selectedRowIds, onSelectionChange, onCommit })));

		return onCommit.mock.calls[0]?.[0];
	}

	beforeEach(() => {
		vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
		root = createRoot(document.createElement("div"));
		onSelectionChange.mockClear();
	});

	afterEach(() => {
		act(() => root.unmount());
		vi.unstubAllGlobals();
	});

	it("применяет последовательные updater, убирает исчезнувшие строки до commit и не восстанавливает их выбор", () => {
		const initial = render(allRows);
		expect(initial?.rowSelection).toEqual({});
		expect(onSelectionChange.mock.calls).toEqual([[[]]]);
		onSelectionChange.mockClear();

		act(() => {
			initial?.setRowSelection((selection) => ({ ...selection, [firstRow.id]: true }));
			initial?.setRowSelection((selection) => ({ ...selection, [secondRow.id]: true }));
		});
		expect(onSelectionChange.mock.calls).toEqual([[allRows]]);
		onSelectionChange.mockClear();

		expect(render([secondRow])?.rowSelection).toEqual({ [secondRow.id]: true });
		expect(onSelectionChange.mock.calls).toEqual([[[secondRow]]]);
		onSelectionChange.mockClear();

		expect(render(allRows)?.rowSelection).toEqual({ [secondRow.id]: true });
		expect(onSelectionChange).not.toHaveBeenCalled();
	});

	it("применяет внешний снимок без уведомления и сообщает о локальном выборе", () => {
		const initial = render(allRows, "single", [firstRow.id]);
		expect(initial?.rowSelection).toEqual({ [firstRow.id]: true });
		expect(onSelectionChange).not.toHaveBeenCalled();

		act(() => initial?.activateRowSelection(secondRow.id, true));
		expect(onSelectionChange.mock.calls).toEqual([[[secondRow]]]);
		onSelectionChange.mockClear();

		expect(render(allRows, "single", [firstRow.id])?.rowSelection).toEqual({ [secondRow.id]: true });
		expect(render(allRows, "single", [secondRow.id, firstRow.id])?.rowSelection).toEqual({ [firstRow.id]: true });
		expect(render(allRows, "single", [firstRow.id, secondRow.id])?.rowSelection).toEqual({ [secondRow.id]: true });
		expect(render(allRows, "single", [])?.rowSelection).toEqual({});
		expect(onSelectionChange).not.toHaveBeenCalled();
	});
});

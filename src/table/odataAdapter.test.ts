import { describe, expect, it } from "vitest";

import {
	createTableColumnVisibilityFromODataMetadata,
	createTableColumnsFromODataMetadata,
	enrichTableColumnsWithODataFormatting,
	resolveTableColumnFormattingContextFromODataColumn
} from "./odataAdapter";

import type { EntityColumnProperty } from "../odata-service";
import type { TableColumnDef } from "./types";

type DemoRow = {
	AMOUNT: number;
	NAME: string;
};

/**
 * Создаёт тестовую OData-колонку с предсказуемыми значениями.
 */
function createMetadataColumn(overrides: Partial<EntityColumnProperty>): EntityColumnProperty {
	return {
		id: "AMOUNT",
		type: "decimal",
		originalType: "Edm.Decimal",
		label: "Сумма",
		semanticType: "none",
		sortable: true,
		filterable: true,
		role: "measure",
		...overrides
	};
}

describe("table odata adapter", () => {
	it("мапит role/type в formatting context", () => {
		expect(resolveTableColumnFormattingContextFromODataColumn(createMetadataColumn({}))).toEqual({
			role: "measure",
			type: "decimal"
		});
	});

	it("создаёт базовые колонки из metadata", () => {
		const columns = createTableColumnsFromODataMetadata<DemoRow>([
			createMetadataColumn({}),
			createMetadataColumn({
				id: "NAME",
				type: "string",
				originalType: "Edm.String",
				label: "Наименование",
				role: "dimension"
			})
		]);

		expect(columns).toEqual([
			{
				id: "AMOUNT",
				accessorKey: "AMOUNT",
				header: "Сумма",
				meta: {
					align: "right",
					formatting: {
						id: "AMOUNT",
						role: "measure",
						type: "decimal"
					}
				}
			},
			{
				id: "NAME",
				accessorKey: "NAME",
				header: "Наименование",
				meta: {
					align: "left",
					formatting: {
						id: "NAME",
						role: "dimension",
						type: "string"
					}
				}
			}
		]);
	});

	it("использует id как fallback для header при отсутствии label", () => {
		const [column] = createTableColumnsFromODataMetadata<DemoRow>([
			createMetadataColumn({
				id: "NO_LABEL",
				label: undefined
			})
		]);

		expect(column.header).toBe("NO_LABEL");
	});

	it("объединяет resolveFormatting с auto role/type в build-колонке", () => {
		const [column] = createTableColumnsFromODataMetadata<DemoRow>([createMetadataColumn({})], {
			resolveFormatting: () => ({
				emptyWhenZero: true
			})
		});

		expect(column.meta?.formatting).toEqual({
			emptyWhenZero: true,
			id: "AMOUNT",
			role: "measure",
			type: "decimal"
		});
	});

	it("строит стартовую видимость и скрывает code-поле при наличии text-пары", () => {
		const visibility = createTableColumnVisibilityFromODataMetadata([
			createMetadataColumn({
				id: "CUSTOMER",
				type: "string",
				originalType: "Edm.String",
				label: "Код клиента",
				role: "dimension",
				semanticType: "code",
				linkedColumnId: "CUSTOMER_Text"
			}),
			createMetadataColumn({
				id: "CUSTOMER_Text",
				type: "string",
				originalType: "Edm.String",
				label: "Клиент",
				role: "dimension",
				semanticType: "text",
				linkedColumnId: "CUSTOMER"
			})
		]);

		expect(visibility).toEqual({
			CUSTOMER: false,
			CUSTOMER_Text: true
		});
	});

	it("отдаёт приоритет resolveVisible при построении стартовой видимости", () => {
		const visibility = createTableColumnVisibilityFromODataMetadata(
			[
				createMetadataColumn({
					id: "CUSTOMER",
					type: "string",
					originalType: "Edm.String",
					label: "Код клиента",
					role: "dimension",
					semanticType: "code",
					linkedColumnId: "CUSTOMER_Text"
				}),
				createMetadataColumn({
					id: "CUSTOMER_Text",
					type: "string",
					originalType: "Edm.String",
					label: "Клиент",
					role: "dimension",
					semanticType: "text",
					linkedColumnId: "CUSTOMER"
				})
			],
			{
				resolveVisible: (column) => column.id === "CUSTOMER"
			}
		);

		expect(visibility).toEqual({
			CUSTOMER: true,
			CUSTOMER_Text: false
		});
	});

	it("дозаполняет role/type без перезаписи существующего formatting", () => {
		const columns: TableColumnDef<DemoRow>[] = [
			{
				id: "AMOUNT",
				accessorKey: "AMOUNT",
				header: "Сумма",
				meta: {
					align: "center",
					formatting: {
						emptyWhenZero: true
					}
				}
			}
		];

		const [column] = enrichTableColumnsWithODataFormatting(columns, [createMetadataColumn({})]);

		expect(column.meta).toEqual({
			align: "center",
			formatting: {
				emptyWhenZero: true,
				id: "AMOUNT",
				role: "measure",
				type: "decimal"
			}
		});
	});

	it("не перезаписывает уже заданные role/type", () => {
		const columns: TableColumnDef<DemoRow>[] = [
			{
				id: "AMOUNT",
				accessorKey: "AMOUNT",
				header: "Сумма",
				meta: {
					formatting: {
						role: "dimension",
						type: "string"
					}
				}
			}
		];

		const [column] = enrichTableColumnsWithODataFormatting(columns, [createMetadataColumn({})]);

		expect(column.meta?.formatting).toEqual({
			role: "dimension",
			type: "string"
		});
	});

	it("рекурсивно обогащает grouped columns", () => {
		const columns: TableColumnDef<DemoRow>[] = [
			{
				id: "group",
				header: "Группа",
				columns: [
					{
						id: "AMOUNT",
						accessorKey: "AMOUNT",
						header: "Сумма"
					}
				]
			}
		];

		const [groupColumn] = enrichTableColumnsWithODataFormatting(columns, [createMetadataColumn({})]);
		const [leafColumn] = ((groupColumn as TableColumnDef<DemoRow> & { columns?: TableColumnDef<DemoRow>[] }).columns ??
			[]) as TableColumnDef<DemoRow>[];

		expect(leafColumn.meta?.formatting).toEqual({
			id: "AMOUNT",
			role: "measure",
			type: "decimal"
		});
	});

	it("игнорирует колонку без stable id", () => {
		const [column] = enrichTableColumnsWithODataFormatting<DemoRow>(
			[
				{
					accessorFn: (row: DemoRow) => row.AMOUNT,
					header: "Сумма"
				}
			],
			[createMetadataColumn({})]
		);

		expect(column).not.toHaveProperty("meta.formatting");
	});

	it("оставляет колонку без изменений при отсутствии metadata", () => {
		const columns: TableColumnDef<DemoRow>[] = [
			{
				id: "AMOUNT",
				accessorKey: "AMOUNT",
				header: "Сумма"
			}
		];

		expect(enrichTableColumnsWithODataFormatting(columns, [])).toEqual(columns);
	});

	it("остаётся совместимым с TableColumnDef на уровне типов", () => {
		const columns: TableColumnDef<DemoRow>[] = enrichTableColumnsWithODataFormatting(
			[
				{
					id: "AMOUNT",
					accessorKey: "AMOUNT",
					header: "Сумма"
				}
			],
			[createMetadataColumn({})]
		);

		expect(columns[0]?.meta?.formatting).toEqual({
			id: "AMOUNT",
			role: "measure",
			type: "decimal"
		});
	});

	it("созданные колонки совместимы с TableColumnDef на уровне типов", () => {
		const columns: TableColumnDef<DemoRow>[] = createTableColumnsFromODataMetadata<DemoRow>([createMetadataColumn({})]);

		expect((columns[0] as (TableColumnDef<DemoRow> & { accessorKey?: string }) | undefined)?.accessorKey).toBe("AMOUNT");
	});
});

import type { RowBasedFormatterDefinition } from "../types";

const fields = ["ZPRODH11", "ZPRODH11_Text", "ZPRODH21", "ZPRODH21_Text"] as const;

function isRowIncludeFields(row: Record<string, unknown>) {
	return fields.some((field) => field in row);
}

export const divideWhenAgFormatter: RowBasedFormatterDefinition = Object.freeze({
	id: "divideWhenAgFormatter",
	name: "Факт при АГ1/2",
	description: "Делит $0 на $1 если в текущей строке есть АГ1 или АГ2.",
	fn: (ctx) => {
		// NOTE: Здесь индекс должен соответствовать порядку зависимостей, поэтому в настройке форматтера нужно сортировать правильно выбранные поля-зависимости.
		const value1 = ctx.num(0);
		const value2 = ctx.num(1);

		if (!isRowIncludeFields(ctx.rowData) && value2 > 0) {
			return value1 / value2;
		}

		return ctx.rawValue;
	}
});

export const valueWhenFieldOrNullFormatter: RowBasedFormatterDefinition = Object.freeze({
	id: "valueWhenFieldOrNull",
	name: "Значение или 0",
	description: "Возвращает своё значение, если зависимое поле != 0, иначе 0.",
	fn: (ctx) => {
		const value = ctx.num(0);

		if (value !== 0) {
			return ctx.rawValue;
		}

		return 0;
	}
});

export const divideWhenFieldOrNullFormatter: RowBasedFormatterDefinition = Object.freeze({
	id: "divideWhenFieldOrNull",
	name: "Факт при АГ1/2 или 0",
	description: "Делит $0 на $1 если в текущей строке есть АГ1 или АГ2, иначе 0.",
	fn: (ctx) => {
		const field = ctx.key(0);

		if (field && field in ctx.rowData) {
			const value0 = ctx.num(0);
			const value1 = ctx.num(1);
			const value2 = ctx.num(2);

			if (!isRowIncludeFields(ctx.rowData) && value2 > 0) {
				return value0 - value1 / value2;
			}

			return value0 - Number(ctx.rawValue);
		}

		return 0;
	}
});

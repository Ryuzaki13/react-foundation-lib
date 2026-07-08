import type { TableFormulaDefinition } from "../types";

export const markupFormula: TableFormulaDefinition = {
	id: "markup",
	name: "Наценка, %",
	description: "Рассчитывает наценку по формуле: A / (B - A) * 100",
	args: ["закупочная цена", "продажная цена"],
	fn: (ctx) => {
		const a = ctx.num(0);
		const b = ctx.num(1);
		const c = b - a;

		if (c === 0) {
			return 0;
		}

		// $0 / ($1 - $0) * 100
		return (a / c) * 100;
	}
};

export const markupSSCFormula: TableFormulaDefinition = {
	id: "markup_ssc",
	name: "Наценка ССЦ, %",
	description: "Рассчитывает наценку по формуле: (A - B) / C",
	args: ["выручка", "план ССЦ", "план"],
	fn: (ctx) => {
		const c = ctx.num(2);
		if (c === 0) return 0;

		const a = ctx.num(0);
		const b = ctx.num(1);

		//  ($0 - $1) / $2
		return (a - b) / c;
	}
};

export const planDeviationPercent: TableFormulaDefinition = {
	id: "plan_deviation_percent",
	name: "% отклонения факта от плана",
	description: "Процент отклонения факта от плана/ГП относительного плана: legacy f1 '($0 - $1) / $1 * 100'",
	fn: (ctx) => {
		const a = ctx.num(0);
		const b = ctx.num(1);

		return ((a - b) / b) * 100;
	}
};

export const growthPercent: TableFormulaDefinition = {
	id: "growth_percent",
	name: "% прироста/снижения к АППГ",
	description: "Процентная динамика к АППГ: legacy f2 '100 * $0 / $1 - 100'",
	fn: (ctx) => {
		const a = ctx.num(0);
		const b = ctx.num(1);

		// Предполагаем, что при b = 0 ожидается в результате 0, а не -100
		if (b === 0) return 0;

		return (100 * a) / b - 100;
	}
};

export const sscPerTon: TableFormulaDefinition = {
	id: "ssc_per_ton",
	name: "ССЦ за тонну",
	description: "ССЦ за тонну (выручка - МП) / тн: legacy f5 ($0 - $1) / $2",
	fn: (ctx) => {
		const a = ctx.num(0);
		const b = ctx.num(1);
		const c = ctx.num(2);

		if (c === 0) return 0;

		return (a * b) / c;
	}
};

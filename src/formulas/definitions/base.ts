import type { TableFormulaDefinition } from "../types";

export const addFormula: TableFormulaDefinition = {
	id: "add",
	name: "Сложение",
	description: "Legacy formula ADD: $0 + $1",
	fn: (ctx) => {
		const a = ctx.num(0);
		const b = ctx.num(1);

		return a + b;
	}
};

export const substractFormula: TableFormulaDefinition = {
	id: "substract",
	name: "Вычитание",
	description: "Legacy formula SUBSTRACT: $0 - $1",
	fn: (ctx) => {
		const a = ctx.num(0);
		const b = ctx.num(1);

		return a - b;
	}
};

export const multiplyFormula: TableFormulaDefinition = {
	id: "multiply",
	name: "Умножение",
	description: "Legacy formula MULTIPLY: $0 * $1",
	fn: (ctx) => {
		const a = ctx.num(0);
		const b = ctx.num(1);

		return a * b;
	}
};

export const divideFormula: TableFormulaDefinition = {
	id: "divide",
	name: "Деление",
	description: "Legacy formula DIVIDE: [$0 / $1]",
	fn: (ctx) => {
		const a = ctx.num(0);
		const b = ctx.num(1);

		if (b === 0) return 0;

		return a / b;
	}
};

export const percentFormula: TableFormulaDefinition = {
	id: "percent",
	name: "Процент",
	description: "Рассчитывает стандартный процент по формуле: B / A * 100.",
	fn: (ctx) => {
		const a = ctx.num(0);
		const b = ctx.num(1);
		const c = b / a;

		if (!isFinite(c)) {
			return 0;
		}

		return c * 100;
	}
};

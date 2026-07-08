import { odataFormatValue } from "./formatters";

import type { BaseType, RowRecord } from "../types";
import type { ODataMetaType } from "./types";

export const FilterOperation = Object.freeze({
	eq: "eq",
	ne: "ne",
	gt: "gt",
	ge: "ge",
	lt: "lt",
	le: "le",
	startswith: "startswith",
	endswith: "endswith",
	contains: "contains"
} as const);

export type FilterOperation = (typeof FilterOperation)[keyof typeof FilterOperation];

export const FILTER_OPERATIONS = Object.freeze(Object.values(FilterOperation)) as readonly FilterOperation[];

const FILTER_OPERATION_LABELS: Readonly<Record<FilterOperation, string>> = Object.freeze({
	eq: "равно",
	ne: "не равно",
	gt: "больше",
	ge: "больше или равно",
	lt: "меньше",
	le: "меньше или равно",
	startswith: "начинается с",
	endswith: "заканчивается на",
	contains: "содержит"
});

const FILTER_OPERATION_SET: ReadonlySet<string> = new Set(FILTER_OPERATIONS);

export function isFilterOperation(value: unknown): value is FilterOperation {
	return typeof value === "string" && FILTER_OPERATION_SET.has(value);
}

export function resolveOperationLabel(operation: FilterOperation): string {
	return FILTER_OPERATION_LABELS[operation];
}

export interface FilterCondition<T> {
	key: keyof T;
	value: BaseType;
	operation?: FilterOperation;
	type?: ODataMetaType;
}

// Базовый интерфейс для выражения
export interface BaseFilterExpression {
	/**
	 * @default false (or)
	 */
	and?: boolean;
}

// Выражение с условиями (лист дерева)
export interface FilterConditionExpression<T> extends BaseFilterExpression {
	conditions: FilterCondition<T>[];
	filters?: never; // Делаем явно недоступным
}

// Выражение с вложенными фильтрами (узел дерева)
export interface FilterNestedExpression<T> extends BaseFilterExpression {
	filters: FilterExpression<T>[];
	conditions?: never; // Делаем явно недоступным
}

// Объединенный тип
export type FilterExpression<T> = FilterConditionExpression<T> | FilterNestedExpression<T>;

function getODataTypeFromValue(value: unknown): ODataMetaType {
	switch (typeof value) {
		case "bigint":
		case "number":
			// NOTE: тут теперь может возникнуть проблема, когда нужен будет long
			return "int";
		case "boolean":
			return "boolean";
		case "object":
			if (value instanceof Date) {
				return "datetime";
			}
	}

	return "string";
}

// Функция для построения условия
function buildCondition<T>(condition: FilterCondition<T>): string {
	const { key, operation = "eq", value, type } = condition;
	const odataType = type ?? getODataTypeFromValue(value);
	const escapedValue = odataFormatValue(odataType, value);

	// Специальные операторы для строк
	if (operation === "contains") {
		return `substringof(${escapedValue},${String(key)})`;
	}

	if (operation === "startswith" || operation === "endswith") {
		return `${operation}(${String(key)}, ${escapedValue})`;
	}

	// Стандартные операторы
	return `${String(key)} ${operation} ${escapedValue}`;
}

// Type guards
function isConditionExpression<T>(expr: FilterExpression<T>): expr is FilterConditionExpression<T> {
	return "conditions" in expr && expr.conditions !== undefined;
}

function isNestedExpression<T>(expr: FilterExpression<T>): expr is FilterNestedExpression<T> {
	return "filters" in expr && expr.filters !== undefined;
}

function compactExpressionStrings<T>(filters: FilterExpression<T>[], build: (expression: FilterExpression<T>) => string): string[] {
	// return filters.map((filter) => build(filter)).filter(Boolean);
	const result: string[] = [];

	for (const filter of filters) {
		const value = build(filter);
		if (value) {
			result.push(value);
		}
	}

	return result;
}

// Основная функция
export function buildODataFilter<T>(expression: FilterExpression<T> | undefined): string {
	if (!expression) return "";

	if (isConditionExpression(expression)) {
		// Обработка выражения с условиями
		const { conditions, and = false } = expression;

		if (conditions.length === 0) {
			return "";
		}

		if (conditions.length === 1) {
			return buildCondition(conditions[0]);
		}

		const operator = and ? "and" : "or";
		const conditionsString = conditions.map(buildCondition).join(` ${operator} `);
		return `(${conditionsString})`;
	}

	if (isNestedExpression(expression)) {
		// Обработка вложенного выражения
		const { filters, and = false } = expression;

		if (filters.length === 0) {
			return "";
		}

		if (filters.length === 1) {
			return buildODataFilter(filters[0]);
		}

		const operator = and ? "and" : "or";
		const filterStrings = compactExpressionStrings(filters, buildODataFilter);

		if (filterStrings.length === 0) {
			return "";
		}

		if (filterStrings.length === 1) {
			return filterStrings[0];
		}

		return `(${filterStrings.join(` ${operator} `)})`;
	}

	throw new Error("Некорректное выражение фильтра");
}

// Альтернативная версия с рекурсивной обработкой
export function buildODataFilterRecursive<T>(expression: FilterExpression<T> | undefined): string {
	const processExpression = (expr: FilterExpression<T> | undefined): string => {
		if (!expr) return "";

		if (isConditionExpression(expr)) {
			const { conditions, and = false } = expr;

			if (conditions.length === 0) return "";
			if (conditions.length === 1) return buildCondition(conditions[0]);

			const operator = and ? "and" : "or";
			return `(${conditions.map(buildCondition).join(` ${operator} `)})`;
		}

		if (isNestedExpression(expr)) {
			const { filters, and = false } = expr;

			if (filters.length === 0) return "";
			if (filters.length === 1) return processExpression(filters[0]);

			const operator = and ? "and" : "or";
			const filterStrings = compactExpressionStrings(filters, processExpression).map((result) => {
				return result.includes(" ") ? `(${result})` : result;
			});

			if (filterStrings.length === 0) return "";
			if (filterStrings.length === 1) return filterStrings[0];

			return `(${filterStrings.join(` ${operator} `)})`;
		}

		return "";
	};

	return processExpression(expression);
}

export function createFilter<T, V extends BaseType>(
	key: keyof T,
	value: (V | V[]) | null | undefined,
	operation: FilterOperation
): FilterExpression<T> {
	if (value === null || value === undefined) return { conditions: [] };

	if (Array.isArray(value)) {
		// return {
		// 	conditions: value.filter((item) => item !== null || item !== undefined).map((item) => ({ key, value: item, operation }))
		// };
		const conditions: FilterCondition<T>[] = [];

		for (const item of value) {
			if (item !== null && item !== undefined) {
				conditions.push({ key, value: item, operation });
			}
		}

		return {
			conditions
		};
	}

	return {
		conditions: [{ key, value, operation }]
	};
}

/**
 * Создает выражение фильтра (`FilterExpression`)
 *
 * Пример конечного выражения:
 *
 * * псевдокод `(key ge odataFormatValue(value[0]) and key le odataFormatValue(value[1]))`
 * * результат `(COST eq 2000 and COST eq 5000)`
 */
export function createFilterBetween<T, V extends BaseType>(key: keyof T, values: readonly [V, V] | null | undefined): FilterExpression<T> {
	if (!values) return { conditions: [] };

	const value1 = values[0];
	const value2 = values[1];

	if (value1 === null || value1 === undefined || value2 === null || value2 === undefined) {
		if (value1) {
			return {
				conditions: [{ key, value: value1, operation: "ge" }]
			};
		}
		if (value2) {
			return {
				conditions: [{ key, value: value2, operation: "le" }]
			};
		}
		return { conditions: [] };
	}

	return {
		and: true,
		conditions: [
			{ key, value: value1, operation: "ge" },
			{ key, value: value2, operation: "le" }
		]
	};
}

/**
 * Создает выражение фильтра (`FilterExpression`)
 *
 * Пример конечного выражения:
 *
 * * псевдокод `key eq odataFormatValue(value)`
 * * результат `CUSTOMER eq '005417554'`
 *
 * Если `value` массив, то выражение формируется с оператором `or`: `(E1 or E2 or E3)`
 */
export function createFilterEqual<T, V extends BaseType>(key: keyof T, value: (V | V[]) | null | undefined): FilterExpression<T> {
	return createFilter(key, value, "eq");
}

export function createFilterEqualFalsy<T, V extends BaseType>(key: keyof T, value: (V | V[]) | null | undefined): FilterExpression<T> {
	return createFilter(key, Array.isArray(value) ? value.map((v) => v || null) : value || null, "eq");
}

/**
 * Создает выражение фильтра (`FilterExpression`)
 *
 * Пример конечного выражения:
 *
 * * псевдокод `substringof(odataFormatValue(value), key)`
 * * результат `substringof('сталь', CUSTOMER)`
 *
 * Если `value` массив, то выражение формируется с оператором `or`: `(E1 or E2 or E3)`
 */
export function createFilterContains<T, V extends BaseType>(key: keyof T, value: (V | V[]) | null | undefined): FilterExpression<T> {
	return createFilter(key, value, "contains");
}

export function mergeFilterExpressions(
	left?: FilterExpression<RowRecord>,
	right?: FilterExpression<RowRecord>
): FilterExpression<RowRecord> | undefined {
	if (!left) return right;
	if (!right) return left;

	return {
		and: true,
		filters: [left, right]
	};
}

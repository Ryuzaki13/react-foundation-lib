export type SqlFilterScalarValue = string | number | boolean;

export type SqlFilterOperation = "eq" | "in";

export type SqlFilterEqualCondition = {
	/** Имя SQL-поля после всех доменных маппингов. */
	fieldId: string;
	/** Оператор строгого равенства. */
	operation: "eq";
	/** Исходное значение фильтра. Неподдерживаемые и пустые значения не сериализуются. */
	value: unknown;
};

export type SqlFilterInCondition = {
	/** Имя SQL-поля после всех доменных маппингов. */
	fieldId: string;
	/** Оператор включения в список значений. */
	operation: "in";
	/** Исходные значения фильтра. Неподдерживаемые и пустые значения не сериализуются. */
	values: readonly unknown[] | null | undefined;
};

export type SqlFilterCondition = SqlFilterEqualCondition | SqlFilterInCondition;

const SQL_FILTER_FIELD_ID_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function isSqlFilterScalarValue(value: unknown): value is SqlFilterScalarValue {
	return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

export function assertSqlFilterFieldId(fieldId: string): void {
	if (!SQL_FILTER_FIELD_ID_PATTERN.test(fieldId)) {
		throw new Error(`Некорректное имя поля SQL-фильтра: ${fieldId}`);
	}
}

export function createSqlFilterEqual(fieldId: string, value: unknown): SqlFilterEqualCondition {
	return { fieldId, operation: "eq", value };
}

export function createSqlFilterIn(fieldId: string, values: readonly unknown[] | null | undefined): SqlFilterInCondition {
	return { fieldId, operation: "in", values };
}

function normalizeSqlFilterValue(value: unknown): string | undefined {
	if (value instanceof Date) {
		throw new Error("Дата должна быть отформатирована вызывающей стороной до формирования SQL-фильтра");
	}

	if (!isSqlFilterScalarValue(value)) return undefined;

	if (typeof value === "number" && !Number.isFinite(value)) return undefined;

	const rawValue = String(value);
	if (!rawValue || rawValue.trim() === "") return undefined;

	return `'${rawValue.replaceAll("'", "''")}'`;
}

function buildSqlFilterCondition(condition: SqlFilterCondition): string | undefined {
	if (condition.operation === "eq") {
		const formattedValue = normalizeSqlFilterValue(condition.value);
		if (!formattedValue) return undefined;

		assertSqlFilterFieldId(condition.fieldId);
		return `${condition.fieldId}=${formattedValue}`;
	}

	const formattedValues = (condition.values ?? [])
		.map((value) => normalizeSqlFilterValue(value))
		.filter((value): value is string => Boolean(value));
	if (formattedValues.length === 0) return undefined;

	assertSqlFilterFieldId(condition.fieldId);
	return `${condition.fieldId} IN (${formattedValues.join(", ")})`;
}

/**
 * Формирует SQL-подобный фильтр для legacy payload, который backend вставляет в dynamic WHERE.
 *
 * Это не OData `$filter`: оператор `IN` здесь допустим только потому, что строка уходит в тело запроса,
 * а не в SAP Gateway URL. Для защиты от падения dynamic WHERE builder намеренно разрешает только
 * простые имена полей и строковые литералы с экранированными одинарными кавычками.
 */
export function buildSqlFilter(conditions: readonly SqlFilterCondition[] | undefined): string {
	if (!conditions) return "";

	return conditions
		.map((condition) => buildSqlFilterCondition(condition))
		.filter((condition): condition is string => Boolean(condition))
		.join(" AND ");
}

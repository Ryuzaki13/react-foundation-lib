import {
	addCalendarDays,
	addCalendarMonths,
	addCalendarYears,
	createCalendarDate,
	formatDateAsDate,
	formatDateAsODataDate,
	getStartOfDay,
	getStartOfMonth,
	getStartOfWeek,
	getStartOfYear,
	parseDateByPattern
} from "../../formatters";
import { aggregateAnalyticalValues } from "../runtime/aggregation";
import { type AnalyticalDataRow, type AnalyticalValues } from "../runtime/types";
import { analyticalIdentity } from "../runtime/valueComparison";

import {
	ANALYTICAL_DATE_GRANULARITY_DAY,
	ANALYTICAL_DATE_GRANULARITY_WEEK,
	ANALYTICAL_DATE_GRANULARITY_MONTH,
	ANALYTICAL_DATE_GRANULARITY_QUARTER,
	ANALYTICAL_DATE_GRANULARITY_YEAR
} from "./analyticalDateColumnConstants";
import {
	type AnalyticalDateColumn,
	type AnalyticalDateColumnsOptions,
	type AnalyticalDateColumnsPlan,
	type ProjectAnalyticalDateFactsOptions
} from "./types";

// Ограничения date-only контракта и календарных периодов не зависят от снимка данных.
const CALENDAR_DATE_TEXT_LENGTH = 10;
const DAYS_PER_WEEK = 7;
const MONTHS_PER_QUARTER = 3;
const DEFAULT_DATE_COLUMN_LIMIT = 366;

/** Принимает только календарный контракт; преобразование timestamp принадлежит transport/domain адаптеру. */
function readCalendarDate(value: unknown): Date | null {
	if (typeof value !== "string" || value.length !== CALENDAR_DATE_TEXT_LENGTH) return null;
	const parsed = parseDateByPattern(value, "yyyy-MM-dd");
	return parsed?.kind === "date-time" ? parsed.date : null;
}

function getDateBucketStart(date: Date, granularity: AnalyticalDateColumnsOptions["granularity"]): Date {
	switch (granularity) {
		case ANALYTICAL_DATE_GRANULARITY_DAY:
			return getStartOfDay(date);
		case ANALYTICAL_DATE_GRANULARITY_WEEK:
			return getStartOfWeek(date, 1);
		case ANALYTICAL_DATE_GRANULARITY_MONTH:
			return getStartOfMonth(date);
		case ANALYTICAL_DATE_GRANULARITY_QUARTER:
			return createCalendarDate(date.getFullYear(), Math.floor(date.getMonth() / MONTHS_PER_QUARTER) * MONTHS_PER_QUARTER, 1);
		case ANALYTICAL_DATE_GRANULARITY_YEAR:
			return getStartOfYear(date);
	}
}

function getNextDateBucketStart(date: Date, granularity: AnalyticalDateColumnsOptions["granularity"]): Date {
	switch (granularity) {
		case ANALYTICAL_DATE_GRANULARITY_DAY:
			return addCalendarDays(date, 1);
		case ANALYTICAL_DATE_GRANULARITY_WEEK:
			return addCalendarDays(date, DAYS_PER_WEEK);
		case ANALYTICAL_DATE_GRANULARITY_MONTH:
			return addCalendarMonths(date, 1);
		case ANALYTICAL_DATE_GRANULARITY_QUARTER:
			return addCalendarMonths(date, MONTHS_PER_QUARTER);
		case ANALYTICAL_DATE_GRANULARITY_YEAR:
			return addCalendarYears(date, 1);
	}
}

/** Строит ограниченный календарный план; ISO-моменты времени сюда не передаются. */
export function createAnalyticalDateColumnsPlan(options: AnalyticalDateColumnsOptions): AnalyticalDateColumnsPlan {
	const from = readCalendarDate(options.from);
	const to = readCalendarDate(options.to);
	if (
		!from ||
		!to ||
		formatDateAsODataDate(from) !== options.from ||
		formatDateAsODataDate(to) !== options.to ||
		options.from > options.to
	)
		throw new Error("Некорректный календарный диапазон аналитических столбцов.");
	const maxColumns = options.maxColumns ?? DEFAULT_DATE_COLUMN_LIMIT;
	if (!Number.isSafeInteger(maxColumns) || maxColumns < 1)
		throw new Error("Лимит динамических столбцов должен быть положительным целым числом.");
	if (!options.id || options.identityColumnIds.length === 0)
		throw new Error("Динамическим столбцам нужны идентификатор и ключи сопоставления фактов.");

	// Идентификатор относится ко всему календарному периоду, границы отбора — только к запрошенной части периода.
	const columns: AnalyticalDateColumn[] = [];
	let start = getDateBucketStart(from, options.granularity);
	while (start <= to) {
		if (columns.length >= maxColumns) throw new Error(`Превышен лимит динамических столбцов: ${maxColumns}`);
		const nextStart = getNextDateBucketStart(start, options.granularity);
		const key = formatDateAsODataDate(start);
		const end = formatDateAsODataDate(addCalendarDays(nextStart, -1));
		columns.push({
			id: `${options.id}:${options.granularity}:${key}`,
			// Подпись дня следует общей настройке date; машинные даты используют штатный odata-date.
			label: options.granularity === ANALYTICAL_DATE_GRANULARITY_DAY ? formatDateAsDate(start) : `${key} — ${end}`,
			from: key < options.from ? options.from : key,
			to: end > options.to ? options.to : end
		});
		start = nextStart;
	}
	return { options: { ...options, identityColumnIds: [...options.identityColumnIds] }, columns };
}

function resolveFactColumnId(fact: AnalyticalValues, plan: AnalyticalDateColumnsPlan): string | undefined {
	// Факт без полного ключа нельзя сопоставить строке; общий итог использует ту же область допустимых фактов.
	if (plan.options.identityColumnIds.some((id) => fact[id] === undefined || fact[id] === null)) return undefined;
	const date = readCalendarDate(fact[plan.options.dateColumnId]);
	if (!date) return undefined;
	const day = formatDateAsODataDate(date);
	if (day < plan.options.from || day > plan.options.to) return undefined;
	return `${plan.options.id}:${plan.options.granularity}:${formatDateAsODataDate(getDateBucketStart(date, plan.options.granularity))}`;
}

/** Индекс содержит исходные значения мер: выбор способа агрегации происходит после сопоставления фактов. */
function indexFactMeasuresByIdentity(
	facts: readonly AnalyticalValues[],
	plan: AnalyticalDateColumnsPlan
): ReadonlyMap<string, ReadonlyMap<string, readonly unknown[]>> {
	const byIdentity = new Map<string, Map<string, unknown[]>>();
	for (const fact of facts) {
		const columnId = resolveFactColumnId(fact, plan);
		if (!columnId) continue;
		const identity = analyticalIdentity(fact, plan.options.identityColumnIds);
		let buckets = byIdentity.get(identity);
		if (!buckets) {
			buckets = new Map();
			byIdentity.set(identity, buckets);
		}
		const bucket = buckets.get(columnId);
		if (bucket) bucket.push(fact[plan.options.measureColumnId]);
		else buckets.set(columnId, [fact[plan.options.measureColumnId]]);
	}
	return byIdentity;
}

/** Сопоставляет отдельные facts составному ключу строки; порядок и количество base rows неизменны. */
export function projectAnalyticalDateFacts<T>(args: ProjectAnalyticalDateFactsOptions<T>): readonly AnalyticalDataRow<T>[] {
	const { rows, facts, plan } = args;
	const byIdentity = indexFactMeasuresByIdentity(facts, plan);
	return rows.map((row) => {
		const buckets = byIdentity.get(analyticalIdentity(row.values, plan.options.identityColumnIds));
		const values: Record<string, unknown> = { ...row.values };
		for (const column of plan.columns) {
			if (Object.hasOwn(values, column.id)) throw new Error(`Динамический столбец перезаписывает исходное поле: ${column.id}`);
			const bucket = buckets?.get(column.id);
			values[column.id] = bucket ? aggregateAnalyticalValues(bucket, plan.options.aggregation) : null;
		}
		return { ...row, values };
	});
}

/**
 * Общие итоги считаются по исходным facts с полным ключом: среднее от средних не подменяет взвешенный результат.
 * Отбор допустимых непустых identities по области доступа и фильтрам выполняет вызывающий адаптер.
 */
export function aggregateAnalyticalDateFacts(facts: readonly AnalyticalValues[], plan: AnalyticalDateColumnsPlan): AnalyticalValues {
	const buckets = new Map<string, unknown[]>();
	for (const fact of facts) {
		const id = resolveFactColumnId(fact, plan);
		if (!id) continue;
		const bucket = buckets.get(id);
		if (bucket) bucket.push(fact[plan.options.measureColumnId]);
		else buckets.set(id, [fact[plan.options.measureColumnId]]);
	}
	return Object.fromEntries(
		plan.columns.map((column) => {
			const bucket = buckets.get(column.id);
			return [column.id, bucket ? aggregateAnalyticalValues(bucket, plan.options.aggregation) : null];
		})
	);
}

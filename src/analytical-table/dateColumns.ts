import {
	addCalendarDays,
	addCalendarMonths,
	addCalendarYears,
	createCalendarDate,
	formatDate,
	getStartOfDay,
	getStartOfMonth,
	getStartOfWeek,
	getStartOfYear,
	parseDateByPattern,
	resolveDateFormatPreset
} from "../formatters";

import { aggregateAnalyticalValues } from "./aggregation";
import {
	type AnalyticalDataRow,
	type AnalyticalDateColumn,
	type AnalyticalDateColumnsOptions,
	type AnalyticalDateColumnsPlan,
	type AnalyticalValues,
	type ProjectAnalyticalDateFactsOptions
} from "./types";
import { analyticalIdentity } from "./valueComparison";

const CALENDAR_FORMAT = resolveDateFormatPreset("yyyy-MM-dd");
const DATE_LABEL_FORMAT = resolveDateFormatPreset("dd.MM.yyyy");

/** Принимает только календарный контракт; преобразование timestamp принадлежит transport/domain адаптеру. */
function readCalendarDate(value: unknown): Date | null {
	if (typeof value !== "string" || value.length !== 10) return null;
	const parsed = parseDateByPattern(value, "yyyy-MM-dd");
	return parsed?.kind === "date-time" ? parsed.date : null;
}

function calendarString(date: Date): string {
	return formatDate(date, CALENDAR_FORMAT);
}

function bucketStart(date: Date, granularity: AnalyticalDateColumnsOptions["granularity"]): Date {
	switch (granularity) {
		case "day":
			return getStartOfDay(date);
		case "week":
			return getStartOfWeek(date, 1);
		case "month":
			return getStartOfMonth(date);
		case "quarter":
			return createCalendarDate(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
		case "year":
			return getStartOfYear(date);
	}
}

function nextBucket(date: Date, granularity: AnalyticalDateColumnsOptions["granularity"]): Date {
	switch (granularity) {
		case "day":
			return addCalendarDays(date, 1);
		case "week":
			return addCalendarDays(date, 7);
		case "month":
			return addCalendarMonths(date, 1);
		case "quarter":
			return addCalendarMonths(date, 3);
		case "year":
			return addCalendarYears(date, 1);
	}
}

/** Строит ограниченный календарный план; ISO-моменты времени сюда не передаются. */
export function createAnalyticalDateColumnsPlan(options: AnalyticalDateColumnsOptions): AnalyticalDateColumnsPlan {
	const from = readCalendarDate(options.from);
	const to = readCalendarDate(options.to);
	if (!from || !to || calendarString(from) !== options.from || calendarString(to) !== options.to || options.from > options.to)
		throw new Error("Некорректный календарный диапазон аналитических столбцов.");
	const maxColumns = options.maxColumns ?? 366;
	if (!Number.isSafeInteger(maxColumns) || maxColumns < 1)
		throw new Error("Лимит динамических столбцов должен быть положительным целым числом.");
	if (!options.id || options.identityColumnIds.length === 0)
		throw new Error("Динамическим столбцам нужны идентификатор и ключи сопоставления фактов.");
	const columns: AnalyticalDateColumn[] = [];
	for (let start = bucketStart(from, options.granularity); start <= to; start = nextBucket(start, options.granularity)) {
		if (columns.length >= maxColumns) throw new Error(`Превышен лимит динамических столбцов: ${maxColumns}`);
		const key = calendarString(start);
		const end = calendarString(addCalendarDays(nextBucket(start, options.granularity), -1));
		columns.push({
			id: `${options.id}:${options.granularity}:${key}`,
			label: options.granularity === "day" ? formatDate(start, DATE_LABEL_FORMAT) : `${key} — ${end}`,
			from: key < options.from ? options.from : key,
			to: end > options.to ? options.to : end
		});
	}
	return { options: { ...options, identityColumnIds: [...options.identityColumnIds] }, columns };
}

function factColumnId(fact: AnalyticalValues, plan: AnalyticalDateColumnsPlan): string | undefined {
	// Факт без полного ключа нельзя сопоставить строке; общий итог использует ту же область допустимых фактов.
	if (plan.options.identityColumnIds.some((id) => fact[id] === undefined || fact[id] === null)) return undefined;
	const date = readCalendarDate(fact[plan.options.dateColumnId]);
	if (!date) return undefined;
	const day = calendarString(date);
	if (day < plan.options.from || day > plan.options.to) return undefined;
	return `${plan.options.id}:${plan.options.granularity}:${calendarString(bucketStart(date, plan.options.granularity))}`;
}

/** Сопоставляет отдельные facts составному ключу строки; порядок и количество base rows неизменны. */
export function projectAnalyticalDateFacts<T>(args: ProjectAnalyticalDateFactsOptions<T>): readonly AnalyticalDataRow<T>[] {
	const { rows, facts, plan } = args;
	const byIdentity = new Map<string, Map<string, unknown[]>>();
	for (const fact of facts) {
		const columnId = factColumnId(fact, plan);
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
		const id = factColumnId(fact, plan);
		if (!id) continue;
		const bucket = buckets.get(id);
		if (bucket) bucket.push(fact[plan.options.measureColumnId]);
		else buckets.set(id, [fact[plan.options.measureColumnId]]);
	}
	return Object.fromEntries(
		plan.columns.map((column) => [
			column.id,
			buckets.has(column.id) ? aggregateAnalyticalValues(buckets.get(column.id) ?? [], plan.options.aggregation) : null
		])
	);
}

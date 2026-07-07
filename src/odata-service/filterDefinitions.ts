import { compareStrings } from "../string-comparison";
import { BaseType, InputType } from "../types";

import { createFilterEqual, type FilterCondition, type FilterExpression, type FilterOperation } from "./filters";

import type { BaseMetaType, ODataChainsMap } from "./types";

type RowRecord = Record<string, unknown>;
type TreeFilterValue = Record<string, string[]>;

export type ODataFilterValue = InputType | TreeFilterValue;
export type ODataFilterValues = Record<string, ODataFilterValue>;

/**
 * Одно условие OData-фильтра, которое может применяться не только к owner-колонке
 * фильтра, но и к явно выбранной колонке. Это нужно для локальных Select/MultiSelect:
 * один runtime-контрол выбирает option, а option уже знает, какую колонку таблицы
 * фильтровать и каким значением.
 */
export type ODataFilterCondition = {
	/**
	 * Целевая колонка условия. Если не задана, компилятор использует ownerColumnId
	 * фильтра, что сохраняет простую модель для обычных локальных value/boolean
	 * фильтров и OData-сегментов.
	 */
	columnId?: string;
	operation: FilterOperation;
	valueSource: "static" | "input";
	value?: BaseType;
};

export type ODataFilterConditionGroup = {
	and?: boolean;
	conditions: ODataFilterCondition[];
};

export type ODataFilterOption = {
	key: string;
	label: string;
	filter?: ODataFilterConditionGroup;
};

export type ODataFilterBinding =
	| {
			kind: "list";
			options: ODataFilterOption[];
	  }
	| {
			kind: "boolean";
			trueFilter?: ODataFilterConditionGroup;
	  }
	| {
			kind: "value";
			valueFilter?: ODataFilterConditionGroup;
	  };

export type FilterDefinitionKind = "segment" | "tree" | "advanced" | "local" | "column";

export type FilterSegmentComponentId = "multi-select" | "select";
export type FilterTreeComponentId = "tree-select" | "tree-multi-select";
export type FilterLocalComponentId = "select" | "multi-select" | "checkbox" | "text-input" | "number-input";
export type FilterAdvancedComponentId = "advanced-search-select";
export type FilterComponentId = FilterSegmentComponentId | FilterTreeComponentId | FilterLocalComponentId | FilterAdvancedComponentId;

// TODO: переименовать, теперь это не только odata
export type ODataCompiledFilterDefinition =
	| {
			id: string;
			ownerColumnId: string;
			columnIds: string[];
			kind: Extract<FilterDefinitionKind, "segment">;
			componentId: FilterSegmentComponentId;
			controlType: BaseMetaType;
			dictionaryCodeKey?: string;
	  }
	| {
			id: string;
			ownerColumnId: string;
			columnIds: string[];
			kind: Extract<FilterDefinitionKind, "tree">;
			componentId: FilterTreeComponentId;
			controlType: BaseMetaType;
	  }
	| {
			id: string;
			ownerColumnId: string;
			columnIds: string[];
			kind: Extract<FilterDefinitionKind, "local">;
			componentId: FilterLocalComponentId;
			controlType: BaseMetaType;
			binding: ODataFilterBinding;
	  }
	| {
			id: string;
			ownerColumnId: string;
			kind: Extract<FilterDefinitionKind, "advanced">;
			componentId: FilterAdvancedComponentId;
			configId: string;
	  }
	| {
			id: string;
			ownerColumnId: string;
			kind: Extract<FilterDefinitionKind, "column">;
	  };

export function isFilterLocalComponentId(value: unknown): value is FilterLocalComponentId {
	return value === "select" || value === "multi-select" || value === "checkbox" || value === "text-input" || value === "number-input";
}

/**
 * Собирает физические колонки, которые реально затрагивает группа условий.
 * Для conditions без columnId берём fallback owner-колонку: это важно для старого
 * поведения value/boolean-фильтров и для conditions, где колонка не выбирается явно.
 */
function collectConditionGroupColumnIds(group: ODataFilterConditionGroup | undefined, fallbackColumnId: string) {
	if (!group?.conditions.length) return [];

	return group.conditions.map((condition) => condition.columnId?.trim() || fallbackColumnId).filter((columnId) => Boolean(columnId));
}

/**
 * Выводит `columnIds` локального фильтра из его binding. Раньше local-фильтр всегда
 * владел только ownerColumnId, но list-option теперь может фильтровать любую
 * доступную visible/data колонку, поэтому runtime и конфликты фильтров должны
 * видеть полный набор затронутых колонок.
 */
function collectBindingColumnIds(binding: ODataFilterBinding, fallbackColumnId: string) {
	const columnIds =
		binding.kind === "list"
			? binding.options.flatMap((option) => collectConditionGroupColumnIds(option.filter, fallbackColumnId))
			: binding.kind === "boolean"
				? collectConditionGroupColumnIds(binding.trueFilter, fallbackColumnId)
				: collectConditionGroupColumnIds(binding.valueFilter, fallbackColumnId);

	return [...new Set(columnIds.length ? columnIds : [fallbackColumnId])];
}

function resolveConditionGroupColumnIds(group: ODataFilterConditionGroup | undefined, fallbackColumnId: string) {
	const columnIds = collectConditionGroupColumnIds(group, fallbackColumnId);
	return columnIds.length ? columnIds : [fallbackColumnId];
}

function resolveListFilterSelectedKeys(definition: Extract<ODataCompiledFilterDefinition, { kind: "local" }>, value: ODataFilterValue) {
	if (definition.componentId === "multi-select") {
		return sanitizeStringArray(value) ?? [];
	}

	const selectedValue = sanitizeScalarValue(value);
	return typeof selectedValue === "string" && selectedValue ? [selectedValue] : [];
}

/**
 * Возвращает все физические колонки, которые потенциально затрагивает filter definition.
 *
 * Helper нужен runtime-проекциям, где важно понять совместимость фильтра с
 * конкретным OData target без повторной реализации правил compiler-а.
 */
export function resolveODataFilterDefinitionColumnIds(definition: ODataCompiledFilterDefinition): string[] {
	const normalizedDefinition = sanitizeFilterDefinitions([definition])[0];
	if (!normalizedDefinition) return [];

	if (normalizedDefinition.kind === "segment" || normalizedDefinition.kind === "column" || normalizedDefinition.kind === "advanced") {
		return [normalizedDefinition.ownerColumnId];
	}

	return [...normalizedDefinition.columnIds];
}

/**
 * Возвращает физические колонки, которые реально затрагивает текущее значение фильтра.
 *
 * Для local list учитываются только выбранные option-ы, поэтому фильтр с
 * несколькими потенциальными колонками не блокирует target, если активный выбор
 * обращается только к доступным колонкам.
 */
export function resolveODataFilterDefinitionActiveColumnIds(
	definition: ODataCompiledFilterDefinition,
	value: ODataFilterValue | undefined
): string[] {
	const normalizedDefinition = sanitizeFilterDefinitions([definition])[0];
	const normalizedValue = sanitizeFilterValue(value);
	if (!normalizedDefinition || normalizedValue === undefined) return [];

	switch (normalizedDefinition.kind) {
		case "segment":
		case "column":
		case "advanced": {
			return [normalizedDefinition.ownerColumnId];
		}

		case "tree": {
			const treeValue = sanitizeTreeFilterValue(normalizedValue);
			if (!treeValue) return [];
			return Object.keys(treeValue).filter((columnId) => normalizedDefinition.columnIds.includes(columnId));
		}

		case "local": {
			if (normalizedDefinition.binding.kind === "list") {
				const selectedKeys = resolveListFilterSelectedKeys(normalizedDefinition, normalizedValue);
				return [
					...new Set(
						selectedKeys.flatMap((selectedKey) => {
							const option =
								normalizedDefinition.binding.kind === "list"
									? normalizedDefinition.binding.options.find((item) => item.key === selectedKey)
									: undefined;
							if (!option) return [];
							return resolveConditionGroupColumnIds(option.filter, normalizedDefinition.ownerColumnId);
						})
					)
				];
			}

			if (normalizedDefinition.binding.kind === "boolean") {
				return normalizedValue === true
					? resolveConditionGroupColumnIds(normalizedDefinition.binding.trueFilter, normalizedDefinition.ownerColumnId)
					: [];
			}

			return resolveConditionGroupColumnIds(normalizedDefinition.binding.valueFilter, normalizedDefinition.ownerColumnId);
		}

		default: {
			const _checker: never = normalizedDefinition;
			void _checker;
			return [];
		}
	}
}

export function normalizeDictionaryCodeKey(value: string | undefined, ownerColumnId: string) {
	const normalized = value?.trim();
	return normalized && normalized !== ownerColumnId ? normalized : undefined;
}

function sanitizeScalarValue(value: unknown): BaseType | undefined {
	if (value instanceof Date) {
		return Number.isFinite(value.getTime()) ? value : undefined;
	}

	if (typeof value === "string") {
		const normalized = value.trim();
		// NOTE: 08.06.2026 разрешаем в фильтр передавать пустую строку
		// return normalized ? normalized : undefined;
		return normalized;
	}

	if (typeof value === "number") {
		return Number.isFinite(value) ? value : undefined;
	}

	if (typeof value === "boolean") {
		return value;
	}

	return undefined;
}

function serializeBaseValue(value: BaseType) {
	if (value instanceof Date) {
		return `date:${value.toISOString()}`;
	}

	return `${typeof value}:${String(value)}`;
}

function sanitizeArrayValue(value: unknown): BaseType[] | undefined {
	if (!Array.isArray(value)) return undefined;

	const seen = new Set<string>();
	const normalized: BaseType[] = [];

	for (const item of value) {
		const nextValue = sanitizeScalarValue(item);
		if (nextValue === undefined) continue;

		const key = serializeBaseValue(nextValue);
		if (seen.has(key)) continue;
		seen.add(key);
		normalized.push(nextValue);
	}

	normalized.sort((left, right) => compareStrings(serializeBaseValue(left), serializeBaseValue(right)));

	return normalized.length ? normalized : undefined;
}

function sanitizeStringArray(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) return undefined;

	const normalized = [
		...new Set(
			value
				.filter((item): item is string => typeof item === "string")
				.map((item) => item.trim())
				.filter(Boolean)
		)
	]; // .sort();
	return normalized.length ? normalized : undefined;
}

function sanitizeTreeFilterValue(value: unknown): TreeFilterValue | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value) || value instanceof Date) return undefined;

	const normalized = Object.fromEntries(
		Object.entries(value)
			.map(([columnId, rawValues]) => [columnId.trim(), sanitizeStringArray(rawValues)] as const)
			.filter((entry): entry is [string, string[]] => Boolean(entry[0]) && Boolean(entry[1]?.length))
	);

	return Object.keys(normalized).length ? normalized : undefined;
}

export function sanitizeFilterConditionGroup(group: ODataFilterConditionGroup | undefined): ODataFilterConditionGroup | undefined {
	if (!group?.conditions?.length) return undefined;

	const conditions: ODataFilterCondition[] = [];

	for (const condition of group.conditions) {
		const value = sanitizeScalarValue(condition.value);
		if (condition.valueSource === "static" && value === undefined) continue;

		conditions.push({
			columnId: condition.columnId?.trim() || undefined,
			operation: condition.operation,
			valueSource: condition.valueSource,
			value
		});
	}

	if (!conditions.length) return undefined;

	return {
		and: group.and === false ? false : group.and ? true : undefined,
		conditions
	};
}

export function sanitizeFilterBinding(binding: ODataFilterBinding | undefined): ODataFilterBinding | undefined {
	if (!binding) return undefined;

	if (binding.kind === "list") {
		const options: ODataFilterOption[] = [];
		// const keysSet = new Set<string>();

		for (const option of binding.options ?? []) {
			const key = option.key.trim();
			// NOTE: пустой ключ разрешаем
			// TODO: подумать, допустимо ли дублирование
			// if (keysSet.has(key)) continue;
			// keysSet.add(key);

			options.push({
				key,
				label: option.label.trim() || key,
				filter: sanitizeFilterConditionGroup(option.filter)
			});
		}

		return options.length ? { kind: "list", options } : undefined;
	}

	if (binding.kind === "boolean") {
		return {
			kind: "boolean",
			trueFilter: sanitizeFilterConditionGroup(binding.trueFilter)
		};
	}

	return {
		kind: "value",
		valueFilter: sanitizeFilterConditionGroup(binding.valueFilter)
	};
}

export function sanitizeFilterDefinitions<T extends ODataCompiledFilterDefinition>(definitions?: readonly T[]): T[] {
	if (!definitions?.length) return [];

	const normalized: T[] = [];

	for (const definition of definitions) {
		const id = definition.id.trim();
		const ownerColumnId = definition.ownerColumnId.trim();
		if (!id || !ownerColumnId) continue;

		// HACK: на период пересохранения всех конфигов
		if ((definition.kind as string) === "odata-segment") {
			definition.kind = "segment";
		}
		if ((definition.kind as string) === "odata-tree") {
			definition.kind = "tree";
		}

		switch (definition.kind) {
			case "segment": {
				normalized.push({
					...definition,
					id,
					ownerColumnId,
					columnIds: [ownerColumnId],
					componentId: definition.componentId === "select" ? "select" : "multi-select",
					dictionaryCodeKey: normalizeDictionaryCodeKey(definition.dictionaryCodeKey, ownerColumnId)
				});
				break;
			}

			case "tree": {
				const columnIds = [...new Set(definition.columnIds.map((columnId) => columnId.trim()).filter(Boolean))];
				if (columnIds.length < 2) break;

				// HACK: на период пересохранения всех конфигов
				definition.componentId = (definition.componentId as string) === "treeSelect" ? "tree-select" : "tree-multi-select";

				normalized.push({
					...definition,
					id,
					ownerColumnId: columnIds.includes(ownerColumnId) ? ownerColumnId : columnIds[0],
					columnIds,
					componentId: definition.componentId === "tree-select" ? "tree-select" : "tree-multi-select"
				});
				break;
			}

			case "local": {
				const binding = sanitizeFilterBinding(definition.binding);
				if (!binding) break;

				normalized.push({
					...definition,
					id,
					ownerColumnId,
					// Для local-фильтров список колонок является производным от conditions.
					// Это делает Select/MultiSelect с option -> columnId частью общего
					// контракта фильтров без отдельной runtime-модели.
					columnIds: collectBindingColumnIds(binding, ownerColumnId),
					binding
				});
				break;
			}

			case "advanced": {
				normalized.push({
					...definition,
					id,
					ownerColumnId
				});
				break;
			}

			case "column": {
				normalized.push({
					...definition,
					id,
					ownerColumnId
				});
				break;
			}

			default: {
				const _checker: never = definition;
				void _checker;
			}
		}
	}

	return normalized;
}

export function sanitizeFilterValue(value: ODataFilterValue | undefined): ODataFilterValue | undefined {
	if (value === null || value === undefined) return undefined;

	const scalarValue = sanitizeScalarValue(value);
	if (scalarValue !== undefined) return scalarValue;

	const arrayValue = sanitizeArrayValue(value);
	if (arrayValue) return arrayValue;

	return sanitizeTreeFilterValue(value);
}

export function sanitizeFilterValues(values?: ODataFilterValues): ODataFilterValues {
	if (!values) return {};

	const normalized: ODataFilterValues = {};

	for (const [key, value] of Object.entries(values)) {
		const filterId = key.trim();
		if (!filterId) continue;

		const nextValue = sanitizeFilterValue(value);
		if (nextValue === undefined) continue;
		normalized[filterId] = nextValue;
	}

	return normalized;
}

export function mergeFilterValuePatch(values: ODataFilterValues | undefined, filterId: string, value: ODataFilterValue | undefined) {
	const normalizedValues = sanitizeFilterValues(values);
	const nextValues = { ...normalizedValues };
	const nextValue = sanitizeFilterValue(value);

	if (nextValue === undefined) {
		delete nextValues[filterId];
		return nextValues;
	}

	nextValues[filterId] = nextValue;
	return nextValues;
}

export function collapseChainedODataSegmentFilterValues(
	values: ODataFilterValues,
	odataSegmentIds: readonly string[],
	chains: ODataChainsMap
): ODataFilterValues {
	if (!values || Object.keys(values).length === 0) return {};

	const result: ODataFilterValues = {};
	const codeToChain: Record<string, string> = {};

	for (const [chainKey, chainItems] of Object.entries(chains)) {
		for (const item of chainItems) {
			codeToChain[item.codeKey] = chainKey;
		}
	}

	const groupedByChain: Record<string, string[]> = {};
	const odataSegmentIdSet = new Set(odataSegmentIds);

	for (const [filterId, value] of Object.entries(values)) {
		const chainKey = codeToChain[filterId];
		const isODataSegment = odataSegmentIdSet.has(filterId);
		const isListValue = Array.isArray(value) || typeof value === "string";

		if (chainKey && isODataSegment && isListValue) {
			groupedByChain[chainKey] = groupedByChain[chainKey] ?? [];
			groupedByChain[chainKey].push(filterId);
			continue;
		}

		result[filterId] = value;
	}

	for (const [chainKey, filterIds] of Object.entries(groupedByChain)) {
		const chain = chains[chainKey];
		if (!chain) continue;

		let deepestFilterId: string | null = null;
		for (const { codeKey } of [...chain].reverse()) {
			if (filterIds.includes(codeKey)) {
				deepestFilterId = codeKey;
				break;
			}
		}

		if (deepestFilterId && values[deepestFilterId] !== undefined) {
			result[deepestFilterId] = values[deepestFilterId];
		}
	}

	return result;
}

function resolveExpressionValue(valueSource: "static" | "input", value: ODataFilterValue | BaseType | undefined) {
	if (valueSource === "static") {
		return sanitizeScalarValue(value);
	}

	return sanitizeScalarValue(value);
}

function compileCondition(
	ownerColumnId: string,
	condition: ODataFilterCondition,
	inputValue?: ODataFilterValue
): FilterCondition<RowRecord> | undefined {
	const value = resolveExpressionValue(condition.valueSource, condition.valueSource === "input" ? inputValue : condition.value);
	if (value === undefined) return undefined;

	return {
		// columnId позволяет одному локальному list-контролу генерировать условия
		// по разным колонкам; ownerColumnId остаётся безопасным fallback для
		// простых фильтров и ранее созданных groups без явной колонки.
		key: condition.columnId?.trim() || ownerColumnId,
		operation: condition.operation,
		value
	};
}

function compileConditionGroup(
	ownerColumnId: string,
	group: ODataFilterConditionGroup | undefined,
	inputValue?: ODataFilterValue
): FilterExpression<RowRecord> | undefined {
	if (!group?.conditions.length) return undefined;

	const conditions = group.conditions
		.map((condition) => compileCondition(ownerColumnId, condition, inputValue))
		.filter((condition): condition is FilterCondition<RowRecord> => Boolean(condition));

	if (!conditions.length) return undefined;

	return {
		and: group.and === false ? undefined : true,
		conditions
	};
}

function compileDefaultBooleanFilter(ownerColumnId: string) {
	return createFilterEqual<RowRecord, true>(ownerColumnId, true);
}

function compileDefaultValueFilter(ownerColumnId: string, value: BaseType | BaseType[]) {
	return createFilterEqual<RowRecord, BaseType>(ownerColumnId, value);
}

function compileTreeFilter(definition: Extract<ODataCompiledFilterDefinition, { kind: "tree" }>, value: ODataFilterValue | undefined) {
	const treeValue = sanitizeTreeFilterValue(value);
	if (!treeValue) return undefined;

	const filters = definition.columnIds
		.map((columnId) => {
			const selectedValues = treeValue[columnId];
			if (!selectedValues?.length) return undefined;

			return createFilterEqual<RowRecord, string>(columnId, selectedValues);
		})
		.filter((filter): filter is FilterExpression<RowRecord> => Boolean(filter));

	if (!filters.length) return undefined;
	if (filters.length === 1) return filters[0];

	return {
		and: true,
		filters
	};
}

function compileListFilter(
	definition: Extract<ODataCompiledFilterDefinition, { kind: "local" }>,
	value: ODataFilterValue | undefined
): FilterExpression<RowRecord> | undefined {
	if (definition.binding.kind !== "list") return undefined;
	const binding = definition.binding;

	if (definition.componentId === "multi-select") {
		const values = sanitizeStringArray(value);
		if (!values?.length) return undefined;

		const filters = values
			.map((selectedKey) => {
				const option = binding.options.find((item: ODataFilterOption) => item.key === selectedKey);
				if (!option) return undefined;

				return (
					compileConditionGroup(definition.ownerColumnId, option.filter) ??
					compileDefaultValueFilter(definition.ownerColumnId, option.key)
				);
			})
			.filter((filter): filter is FilterExpression<RowRecord> => Boolean(filter));

		if (!filters.length) return undefined;
		if (filters.length === 1) return filters[0];

		return {
			filters
		};
	}

	const selectedValue = sanitizeScalarValue(value);
	if (typeof selectedValue !== "string" || !selectedValue) return undefined;

	const option = binding.options.find((item: ODataFilterOption) => item.key === selectedValue);
	if (!option) return undefined;

	return (
		compileConditionGroup(definition.ownerColumnId, option.filter) ?? compileDefaultValueFilter(definition.ownerColumnId, option.key)
	);
}

function compileDefinitionFilter(
	definition: ODataCompiledFilterDefinition,
	value: ODataFilterValue | undefined
): FilterExpression<RowRecord> | undefined {
	if (value === undefined) return undefined;

	switch (definition.kind) {
		case "segment": {
			if (definition.componentId === "select") {
				const scalarValue = sanitizeScalarValue(value);
				return scalarValue !== undefined ? compileDefaultValueFilter(definition.ownerColumnId, scalarValue) : undefined;
			}

			const arrayValue = sanitizeArrayValue(value);
			return arrayValue?.length ? compileDefaultValueFilter(definition.ownerColumnId, arrayValue) : undefined;
		}

		case "tree": {
			return compileTreeFilter(definition, value);
		}

		case "local": {
			if (definition.binding.kind === "list") {
				return compileListFilter(definition, value);
			}

			if (definition.binding.kind === "boolean") {
				if (value !== true) return undefined;
				return (
					compileConditionGroup(definition.ownerColumnId, definition.binding.trueFilter) ??
					compileDefaultBooleanFilter(definition.ownerColumnId)
				);
			}

			return (
				compileConditionGroup(definition.ownerColumnId, definition.binding.valueFilter, value) ??
				(() => {
					const scalarValue = sanitizeScalarValue(value);
					const arrayValue = sanitizeArrayValue(value);
					const defaultValue = scalarValue ?? arrayValue;
					return defaultValue !== undefined ? compileDefaultValueFilter(definition.ownerColumnId, defaultValue) : undefined;
				})()
			);
		}

		case "column": {
			const scalarValue = sanitizeScalarValue(value);
			const arrayValue = sanitizeArrayValue(value);
			const defaultValue = scalarValue ?? arrayValue;
			return defaultValue !== undefined ? compileDefaultValueFilter(definition.ownerColumnId, defaultValue) : undefined;
		}

		case "advanced": {
			const arrayValue = sanitizeArrayValue(value);
			return arrayValue?.length ? compileDefaultValueFilter(definition.ownerColumnId, arrayValue) : undefined;
		}

		default: {
			const _checker: never = definition;
			void _checker;
		}
	}
}

export function compileFiltersToExpression(
	definitions?: readonly ODataCompiledFilterDefinition[],
	values?: ODataFilterValues
): FilterExpression<RowRecord> | undefined {
	const normalizedDefinitions = sanitizeFilterDefinitions(definitions);
	const normalizedValues = sanitizeFilterValues(values);
	if (!normalizedDefinitions.length || !Object.keys(normalizedValues).length) return undefined;

	const filters = normalizedDefinitions
		.map((definition) => compileDefinitionFilter(definition, normalizedValues[definition.id]))
		.filter((filter): filter is FilterExpression<RowRecord> => Boolean(filter));

	if (!filters.length) return undefined;
	if (filters.length === 1) return filters[0];

	return {
		and: true,
		filters
	};
}

export function flattenFilterValuesToODataDependencies(
	definitions?: readonly ODataCompiledFilterDefinition[],
	values?: ODataFilterValues
): Record<string, string[]> {
	const normalizedDefinitions = sanitizeFilterDefinitions(definitions);
	const normalizedValues = sanitizeFilterValues(values);
	const dependencies: Record<string, string[]> = {};

	for (const definition of normalizedDefinitions) {
		if (definition.kind !== "segment" && definition.kind !== "tree") continue;

		const value = normalizedValues[definition.id];
		if (value === undefined) continue;

		if (definition.kind === "segment") {
			const scalarValue = typeof value === "string" ? value : undefined;
			const arrayValue = sanitizeStringArray(value);
			const selectedValues = scalarValue ? [scalarValue] : arrayValue;
			if (!selectedValues?.length) continue;

			dependencies[definition.dictionaryCodeKey ?? definition.ownerColumnId] = selectedValues;
			continue;
		}

		const treeValue = sanitizeTreeFilterValue(value);
		if (!treeValue) continue;

		for (const [columnId, selectedValues] of Object.entries(treeValue)) {
			if (!selectedValues.length) continue;
			dependencies[columnId] = selectedValues;
		}
	}

	return dependencies;
}

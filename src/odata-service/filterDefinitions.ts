import { compareStrings } from "../string-comparison";
import { BaseType, InputType } from "../types";

import {
	FILTER_BINDING_BOOLEAN,
	FILTER_BINDING_LIST,
	FILTER_BINDING_VALUE,
	type FILTER_COMPONENT_ADVANCED_SEARCH_SELECT,
	FILTER_COMPONENT_CHECKBOX,
	FILTER_COMPONENT_MULTI_SELECT,
	FILTER_COMPONENT_NUMBER_INPUT,
	FILTER_COMPONENT_SELECT,
	FILTER_COMPONENT_TEXT_INPUT,
	FILTER_COMPONENT_TREE_MULTI_SELECT,
	FILTER_COMPONENT_TREE_SELECT,
	FILTER_KIND_ADVANCED,
	FILTER_KIND_COLUMN,
	FILTER_KIND_LOCAL,
	FILTER_KIND_REGISTERED,
	FILTER_KIND_SEGMENT,
	FILTER_KIND_TREE,
	FILTER_VALUE_MODE_MULTIPLE,
	FILTER_VALUE_MODE_SINGLE,
	FILTER_VALUE_SOURCE_INPUT,
	FILTER_VALUE_SOURCE_STATIC
} from "./filterDefinitionConstants";
import { type FILTER_LOGICAL_AND, FILTER_LOGICAL_OR } from "./filterOperationConstants";
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
	valueSource: typeof FILTER_VALUE_SOURCE_STATIC | typeof FILTER_VALUE_SOURCE_INPUT;
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
			kind: typeof FILTER_BINDING_LIST;
			/** Связка выражений нескольких выбранных опций: `false`/отсутствие означает OR. */
			and?: boolean;
			options: ODataFilterOption[];
	  }
	| {
			kind: typeof FILTER_BINDING_BOOLEAN;
			trueFilter?: ODataFilterConditionGroup;
	  }
	| {
			kind: typeof FILTER_BINDING_VALUE;
			valueFilter?: ODataFilterConditionGroup;
	  };

export type FilterDefinitionKind =
	| typeof FILTER_KIND_SEGMENT
	| typeof FILTER_KIND_TREE
	| typeof FILTER_KIND_ADVANCED
	| typeof FILTER_KIND_LOCAL
	| typeof FILTER_KIND_REGISTERED
	| typeof FILTER_KIND_COLUMN;

/** Форма controlled-значения зарегистрированного фильтра. */
export type FilterRegisteredValueMode = typeof FILTER_VALUE_MODE_SINGLE | typeof FILTER_VALUE_MODE_MULTIPLE;

export type FilterSegmentComponentId = typeof FILTER_COMPONENT_MULTI_SELECT | typeof FILTER_COMPONENT_SELECT;
export type FilterTreeComponentId = typeof FILTER_COMPONENT_TREE_SELECT | typeof FILTER_COMPONENT_TREE_MULTI_SELECT;
export type FilterLocalComponentId =
	| typeof FILTER_COMPONENT_SELECT
	| typeof FILTER_COMPONENT_MULTI_SELECT
	| typeof FILTER_COMPONENT_CHECKBOX
	| typeof FILTER_COMPONENT_TEXT_INPUT
	| typeof FILTER_COMPONENT_NUMBER_INPUT;
export type FilterAdvancedComponentId = typeof FILTER_COMPONENT_ADVANCED_SEARCH_SELECT;
export type FilterComponentId = FilterSegmentComponentId | FilterTreeComponentId | FilterLocalComponentId | FilterAdvancedComponentId;

// TODO: переименовать, теперь это не только odata
export type ODataCompiledFilterDefinition =
	| {
			id: string;
			ownerColumnId: string;
			columnIds: string[];
			kind: Extract<FilterDefinitionKind, typeof FILTER_KIND_SEGMENT>;
			componentId: FilterSegmentComponentId;
			controlType: BaseMetaType;
			dictionaryCodeKey?: string;
	  }
	| {
			id: string;
			ownerColumnId: string;
			columnIds: string[];
			kind: Extract<FilterDefinitionKind, typeof FILTER_KIND_TREE>;
			componentId: FilterTreeComponentId;
			controlType: BaseMetaType;
			/** Оператор между выбранными значениями разных уровней дерева. */
			levelOperator?: typeof FILTER_LOGICAL_AND | typeof FILTER_LOGICAL_OR;
	  }
	| {
			id: string;
			ownerColumnId: string;
			columnIds: string[];
			kind: Extract<FilterDefinitionKind, typeof FILTER_KIND_LOCAL>;
			componentId: FilterLocalComponentId;
			controlType: BaseMetaType;
			binding: ODataFilterBinding;
	  }
	| {
			id: string;
			kind: Extract<FilterDefinitionKind, typeof FILTER_KIND_REGISTERED>;
			/** Id непрозрачного runtime-компонента из внешнего registry. */
			componentId: string;
			controlType: BaseMetaType;
			valueMode: FilterRegisteredValueMode;
			/** Потенциально затрагиваемые физические колонки, производные от binding. */
			columnIds: string[];
			/** Отсутствует у parameter-only фильтра, который не формирует `$filter`. */
			binding?: ODataFilterBinding;
	  }
	| {
			id: string;
			ownerColumnId: string;
			kind: Extract<FilterDefinitionKind, typeof FILTER_KIND_ADVANCED>;
			componentId: FilterAdvancedComponentId;
			configId: string;
	  }
	| {
			id: string;
			ownerColumnId: string;
			kind: Extract<FilterDefinitionKind, typeof FILTER_KIND_COLUMN>;
	  };

export function isFilterLocalComponentId(value: unknown): value is FilterLocalComponentId {
	return (
		value === FILTER_COMPONENT_SELECT ||
		value === FILTER_COMPONENT_MULTI_SELECT ||
		value === FILTER_COMPONENT_CHECKBOX ||
		value === FILTER_COMPONENT_TEXT_INPUT ||
		value === FILTER_COMPONENT_NUMBER_INPUT
	);
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
		binding.kind === FILTER_BINDING_LIST
			? binding.options.flatMap((option) => collectConditionGroupColumnIds(option.filter, fallbackColumnId))
			: binding.kind === FILTER_BINDING_BOOLEAN
				? collectConditionGroupColumnIds(binding.trueFilter, fallbackColumnId)
				: collectConditionGroupColumnIds(binding.valueFilter, fallbackColumnId);

	return [...new Set(columnIds.length ? columnIds : fallbackColumnId ? [fallbackColumnId] : [])];
}

function resolveConditionGroupColumnIds(group: ODataFilterConditionGroup | undefined, fallbackColumnId: string) {
	const columnIds = collectConditionGroupColumnIds(group, fallbackColumnId);
	return columnIds.length ? columnIds : fallbackColumnId ? [fallbackColumnId] : [];
}

type ListFilterDefinition = Extract<ODataCompiledFilterDefinition, { kind: typeof FILTER_KIND_LOCAL | typeof FILTER_KIND_REGISTERED }>;

function isMultipleListFilterDefinition(definition: ListFilterDefinition) {
	return definition.kind === FILTER_KIND_REGISTERED
		? definition.valueMode === FILTER_VALUE_MODE_MULTIPLE
		: definition.componentId === FILTER_COMPONENT_MULTI_SELECT;
}

/** Нормализует option keys и сохраняет пустую строку как допустимый выбор. */
function sanitizeFilterOptionKeys(value: unknown): string[] {
	if (!Array.isArray(value)) return [];

	return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()))];
}

function resolveListFilterSelectedKeys(definition: ListFilterDefinition, value: ODataFilterValue) {
	if (isMultipleListFilterDefinition(definition)) {
		return sanitizeFilterOptionKeys(value);
	}

	const selectedValue = sanitizeScalarValue(value);
	return typeof selectedValue === "string" ? [selectedValue] : [];
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

	if (normalizedDefinition.kind === FILTER_KIND_REGISTERED) {
		return [...normalizedDefinition.columnIds];
	}

	if (
		normalizedDefinition.kind === FILTER_KIND_SEGMENT ||
		normalizedDefinition.kind === FILTER_KIND_COLUMN ||
		normalizedDefinition.kind === FILTER_KIND_ADVANCED
	) {
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
		case FILTER_KIND_SEGMENT:
		case FILTER_KIND_COLUMN:
		case FILTER_KIND_ADVANCED: {
			return [normalizedDefinition.ownerColumnId];
		}

		case FILTER_KIND_TREE: {
			const treeValue = sanitizeTreeFilterValue(normalizedValue);
			if (!treeValue) return [];
			return Object.keys(treeValue).filter((columnId) => normalizedDefinition.columnIds.includes(columnId));
		}

		case FILTER_KIND_LOCAL: {
			if (normalizedDefinition.binding.kind === FILTER_BINDING_LIST) {
				const selectedKeys = resolveListFilterSelectedKeys(normalizedDefinition, normalizedValue);
				return [
					...new Set(
						selectedKeys.flatMap((selectedKey) => {
							const option =
								normalizedDefinition.binding.kind === FILTER_BINDING_LIST
									? normalizedDefinition.binding.options.find((item) => item.key === selectedKey)
									: undefined;
							if (!option) return [];
							return resolveConditionGroupColumnIds(option.filter, normalizedDefinition.ownerColumnId);
						})
					)
				];
			}

			if (normalizedDefinition.binding.kind === FILTER_BINDING_BOOLEAN) {
				return normalizedValue === true
					? resolveConditionGroupColumnIds(normalizedDefinition.binding.trueFilter, normalizedDefinition.ownerColumnId)
					: [];
			}

			return resolveConditionGroupColumnIds(normalizedDefinition.binding.valueFilter, normalizedDefinition.ownerColumnId);
		}

		case FILTER_KIND_REGISTERED: {
			const binding = normalizedDefinition.binding;
			if (!binding) return [];

			if (binding.kind === FILTER_BINDING_LIST) {
				const selectedKeys = resolveListFilterSelectedKeys(normalizedDefinition, normalizedValue);
				return [
					...new Set(
						selectedKeys.flatMap((selectedKey) => {
							const option = binding.options.find((item) => item.key === selectedKey);
							return option ? resolveConditionGroupColumnIds(option.filter, "") : [];
						})
					)
				];
			}

			if (binding.kind === FILTER_BINDING_BOOLEAN) {
				return normalizedValue === true ? resolveConditionGroupColumnIds(binding.trueFilter, "") : [];
			}

			return resolveConditionGroupColumnIds(binding.valueFilter, "");
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
		if (condition.valueSource === FILTER_VALUE_SOURCE_STATIC && value === undefined) continue;

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

	if (binding.kind === FILTER_BINDING_LIST) {
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

		if (!options.length) return undefined;

		const and = binding.and === true ? true : binding.and === false ? false : undefined;
		return {
			kind: FILTER_BINDING_LIST,
			...(and === undefined ? {} : { and }),
			options
		};
	}

	if (binding.kind === FILTER_BINDING_BOOLEAN) {
		return {
			kind: FILTER_BINDING_BOOLEAN,
			trueFilter: sanitizeFilterConditionGroup(binding.trueFilter)
		};
	}

	return {
		kind: FILTER_BINDING_VALUE,
		valueFilter: sanitizeFilterConditionGroup(binding.valueFilter)
	};
}

export function sanitizeFilterDefinitions<T extends ODataCompiledFilterDefinition>(definitions?: readonly T[]): T[] {
	if (!definitions?.length) return [];

	const normalized: T[] = [];

	for (const definition of definitions) {
		const id = definition.id.trim();
		if (!id) continue;
		/*
		 * Sanitizer может получать readonly snapshot из Zustand/Immer. Legacy-поля
		 * нормализуем только на локальной копии, чтобы чтение конфигурации никогда
		 * не изменяло и не пыталось разморозить входной объект.
		 */
		const normalizedDefinition = { ...definition };

		// HACK: на период пересохранения всех конфигов
		if ((normalizedDefinition.kind as string) === "odata-segment") {
			normalizedDefinition.kind = FILTER_KIND_SEGMENT;
		}
		if ((normalizedDefinition.kind as string) === "odata-tree") {
			normalizedDefinition.kind = FILTER_KIND_TREE;
		}

		if (normalizedDefinition.kind === FILTER_KIND_REGISTERED) {
			const componentId = normalizedDefinition.componentId.trim();
			const valueMode = normalizedDefinition.valueMode;
			if (!componentId || (valueMode !== FILTER_VALUE_MODE_SINGLE && valueMode !== FILTER_VALUE_MODE_MULTIPLE)) continue;

			const binding = sanitizeFilterBinding(normalizedDefinition.binding);
			normalized.push({
				...normalizedDefinition,
				id,
				componentId,
				valueMode,
				columnIds: binding ? collectBindingColumnIds(binding, "") : [],
				binding
			});
			continue;
		}

		const ownerColumnId = normalizedDefinition.ownerColumnId.trim();
		if (!ownerColumnId) continue;

		switch (normalizedDefinition.kind) {
			case FILTER_KIND_SEGMENT: {
				normalized.push({
					...normalizedDefinition,
					id,
					ownerColumnId,
					columnIds: [ownerColumnId],
					componentId:
						normalizedDefinition.componentId === FILTER_COMPONENT_SELECT
							? FILTER_COMPONENT_SELECT
							: FILTER_COMPONENT_MULTI_SELECT,
					dictionaryCodeKey: normalizeDictionaryCodeKey(normalizedDefinition.dictionaryCodeKey, ownerColumnId)
				});
				break;
			}

			case FILTER_KIND_TREE: {
				const columnIds = [...new Set(normalizedDefinition.columnIds.map((columnId) => columnId.trim()).filter(Boolean))];
				/*
				 * Визуальное дерево может иметь consumer-синтетический root, который не
				 * участвует в серверном фильтре. Поэтому definition обязан содержать хотя
				 * бы одно фильтруемое поле, но не обязан сериализовать два UI-уровня.
				 */
				if (!columnIds.length) break;

				// HACK: на период пересохранения всех конфигов
				const rawComponentId = normalizedDefinition.componentId as string;
				const componentId =
					rawComponentId === "treeSelect" || rawComponentId === FILTER_COMPONENT_TREE_SELECT
						? FILTER_COMPONENT_TREE_SELECT
						: FILTER_COMPONENT_TREE_MULTI_SELECT;

				normalized.push({
					...normalizedDefinition,
					id,
					ownerColumnId: columnIds.includes(ownerColumnId) ? ownerColumnId : columnIds[0],
					columnIds,
					componentId,
					levelOperator: normalizedDefinition.levelOperator === FILTER_LOGICAL_OR ? FILTER_LOGICAL_OR : undefined
				});
				break;
			}

			case FILTER_KIND_LOCAL: {
				const binding = sanitizeFilterBinding(normalizedDefinition.binding);
				if (!binding) break;

				normalized.push({
					...normalizedDefinition,
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

			case FILTER_KIND_ADVANCED: {
				normalized.push({
					...normalizedDefinition,
					id,
					ownerColumnId
				});
				break;
			}

			case FILTER_KIND_COLUMN: {
				normalized.push({
					...normalizedDefinition,
					id,
					ownerColumnId
				});
				break;
			}

			default: {
				const _checker: never = normalizedDefinition;
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

function resolveExpressionValue(
	valueSource: typeof FILTER_VALUE_SOURCE_STATIC | typeof FILTER_VALUE_SOURCE_INPUT,
	value: ODataFilterValue | BaseType | undefined
) {
	if (valueSource === FILTER_VALUE_SOURCE_STATIC) {
		return sanitizeScalarValue(value);
	}

	return sanitizeScalarValue(value);
}

function compileCondition(
	ownerColumnId: string,
	condition: ODataFilterCondition,
	inputValue?: ODataFilterValue
): FilterCondition<RowRecord> | undefined {
	const value = resolveExpressionValue(
		condition.valueSource,
		condition.valueSource === FILTER_VALUE_SOURCE_INPUT ? inputValue : condition.value
	);
	if (value === undefined) return undefined;
	const targetColumnId = condition.columnId?.trim() || ownerColumnId;
	if (!targetColumnId) return undefined;

	return {
		// columnId позволяет одному локальному list-контролу генерировать условия
		// по разным колонкам; ownerColumnId остаётся безопасным fallback для
		// простых фильтров и ранее созданных groups без явной колонки.
		key: targetColumnId,
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

function compileTreeFilter(
	definition: Extract<ODataCompiledFilterDefinition, { kind: typeof FILTER_KIND_TREE }>,
	value: ODataFilterValue | undefined
) {
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
		and: definition.levelOperator === FILTER_LOGICAL_OR ? undefined : true,
		filters
	};
}

function compileListFilter(definition: ListFilterDefinition, value: ODataFilterValue | undefined): FilterExpression<RowRecord> | undefined {
	if (!definition.binding || definition.binding.kind !== FILTER_BINDING_LIST) return undefined;
	const binding = definition.binding;
	const selectedKeys = resolveListFilterSelectedKeys(definition, value);
	if (!selectedKeys.length) return undefined;

	const fallbackColumnId = definition.kind === FILTER_KIND_LOCAL ? definition.ownerColumnId : "";
	const filters = selectedKeys
		.map((selectedKey) => {
			const option = binding.options.find((item) => item.key === selectedKey);
			if (!option) return undefined;

			const explicitFilter = compileConditionGroup(fallbackColumnId, option.filter);
			if (explicitFilter || definition.kind === FILTER_KIND_REGISTERED) return explicitFilter;

			return compileDefaultValueFilter(definition.ownerColumnId, option.key);
		})
		.filter((filter): filter is FilterExpression<RowRecord> => Boolean(filter));

	if (!filters.length) return undefined;
	if (filters.length === 1) return filters[0];

	return {
		and: binding.and === true ? true : undefined,
		filters
	};
}

function compileDefinitionFilter(
	definition: ODataCompiledFilterDefinition,
	value: ODataFilterValue | undefined
): FilterExpression<RowRecord> | undefined {
	if (value === undefined) return undefined;

	switch (definition.kind) {
		case FILTER_KIND_SEGMENT: {
			if (definition.componentId === FILTER_COMPONENT_SELECT) {
				const scalarValue = sanitizeScalarValue(value);
				return scalarValue !== undefined ? compileDefaultValueFilter(definition.ownerColumnId, scalarValue) : undefined;
			}

			const arrayValue = sanitizeArrayValue(value);
			return arrayValue?.length ? compileDefaultValueFilter(definition.ownerColumnId, arrayValue) : undefined;
		}

		case FILTER_KIND_TREE: {
			return compileTreeFilter(definition, value);
		}

		case FILTER_KIND_LOCAL: {
			if (definition.binding.kind === FILTER_BINDING_LIST) {
				return compileListFilter(definition, value);
			}

			if (definition.binding.kind === FILTER_BINDING_BOOLEAN) {
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

		case FILTER_KIND_REGISTERED: {
			if (!definition.binding) return undefined;

			if (definition.binding.kind === FILTER_BINDING_LIST) {
				return compileListFilter(definition, value);
			}

			if (definition.binding.kind === FILTER_BINDING_BOOLEAN) {
				return value === true ? compileConditionGroup("", definition.binding.trueFilter) : undefined;
			}

			return compileConditionGroup("", definition.binding.valueFilter, value);
		}

		case FILTER_KIND_COLUMN: {
			const scalarValue = sanitizeScalarValue(value);
			const arrayValue = sanitizeArrayValue(value);
			const defaultValue = scalarValue ?? arrayValue;
			return defaultValue !== undefined ? compileDefaultValueFilter(definition.ownerColumnId, defaultValue) : undefined;
		}

		case FILTER_KIND_ADVANCED: {
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
		if (definition.kind !== FILTER_KIND_SEGMENT && definition.kind !== FILTER_KIND_TREE) continue;

		const value = normalizedValues[definition.id];
		if (value === undefined) continue;

		if (definition.kind === FILTER_KIND_SEGMENT) {
			const scalarValue = typeof value === "string" ? value : undefined;
			const arrayValue = sanitizeStringArray(value);
			const selectedValues = scalarValue ? [scalarValue] : arrayValue;
			if (!selectedValues?.length) continue;

			dependencies[definition.dictionaryCodeKey ?? definition.ownerColumnId] = selectedValues;
			continue;
		}

		const treeValue = sanitizeTreeFilterValue(value);
		if (!treeValue) continue;

		for (const columnId of definition.columnIds) {
			const selectedValues = treeValue[columnId];
			if (!selectedValues) continue;
			if (!selectedValues.length) continue;
			dependencies[columnId] = selectedValues;
		}
	}

	return dependencies;
}

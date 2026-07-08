import type { TableFormulaCompiledExecutor, TableFormulaRowData } from "../../formulas";
import type { ColumnRole, ODataMetaType } from "../../odata-service";
import type { State } from "../../types";
import type { ThresholdDefinition } from "../valueState/types";

/**
 * Идентификаторы поддерживаемых форматтеров pipeline.
 */
export type FormattersPipelineFormatterId = "normalizeLeadingZeros" | "rowBasedOverride" | "resolveValueState" | "typedValueFormat";

/**
 * Позиция иконки относительно текстового значения.
 */
export type FormattersPipelineIconPosition = "left" | "right";

/**
 * Настройки отображения иконки для форматтера состояния.
 */
export type FormattersPipelineValueStateIconSettings = {
	enabled?: boolean;
	showValue?: boolean;
	position?: FormattersPipelineIconPosition;
};

/**
 * Конфигурация резолвера фиксированных значений.
 */
export type FormattersPipelineFixedValueStateConfig = {
	kind: "fixed";
	entries: Record<string, State>;
	fallbackState?: State;
};

/**
 * Конфигурация порогового резолвера.
 */
export type FormattersPipelineThresholdValueStateConfig = {
	kind: "threshold";
	thresholds: Array<number | ThresholdDefinition>;
	states: State[];
	invalidState?: State;
};

/**
 * Единый контракт конфигурации state-форматтера.
 */
export type FormattersPipelineValueStateResolverConfig =
	FormattersPipelineFixedValueStateConfig | FormattersPipelineThresholdValueStateConfig;

/**
 * Настройки форматтера `normalizeLeadingZeros`.
 */
export type FormattersPipelineNormalizeLeadingZerosConfig = {
	fixed?: number;
};

/**
 * Настройки форматтера `rowBasedOverride` (подмена по полю строки).
 */
export type FormattersPipelineRowBasedOverrideFieldConfig = {
	mode: "field";
	fieldKey: string;
	fallbackToRaw?: boolean;
};

/**
 * Настройки форматтера `rowBasedOverride` (подмена через формулу отдельного реестра).
 */
export type FormattersPipelineRowBasedOverrideFormulaConfig = {
	mode: "formula";
	formulaId: string;
	dependencyIds?: string[];
	fallbackToRaw?: boolean;
};

/**
 * Единый контракт конфигурации форматтера `rowBasedOverride`.
 */
export type FormattersPipelineRowBasedOverrideConfig =
	FormattersPipelineRowBasedOverrideFieldConfig | FormattersPipelineRowBasedOverrideFormulaConfig;

/**
 * Узел форматтера `normalizeLeadingZeros`.
 */
export type FormattersPipelineNormalizeLeadingZerosNode = {
	id: string;
	type: "normalizeLeadingZeros";
	position: {
		x: number;
		y: number;
	};
	config?: FormattersPipelineNormalizeLeadingZerosConfig;
};

/**
 * Узел форматтера `rowBasedOverride`.
 */
export type FormattersPipelineRowBasedOverrideNode = {
	id: string;
	type: "rowBasedOverride";
	position: {
		x: number;
		y: number;
	};
	config: FormattersPipelineRowBasedOverrideConfig;
};

export type FormattersPipelineResolveValueStateConfig = {
	resolver: FormattersPipelineValueStateResolverConfig;
	icon?: FormattersPipelineValueStateIconSettings;
};

/**
 * Узел форматтера `resolveValueState`.
 */
export type FormattersPipelineResolveValueStateNode = {
	id: string;
	type: "resolveValueState";
	position: {
		x: number;
		y: number;
	};
	config: FormattersPipelineResolveValueStateConfig;
};

/**
 * Настройки форматтера `typedValueFormat`.
 */
export type FormattersPipelineTypedValueFormatConfig = {
	/**
	 * Имя пресета числового форматирования из `shared/lib/formatters/number/presets`.
	 *
	 * Используется для колонок, чей базовый тип определяется как `number`.
	 */
	numberPresetName?: string;

	/**
	 * Имя пресета числового форматирования из `shared/lib/formatters/date/presets`.
	 *
	 * Используется для колонок, чей базовый тип определяется как `date`.
	 */
	datePresetName?: string;
	// booleanPresetName?: string;
	// stringPresetName?: string;
};

/**
 * Узел форматтера `typedValueFormat`.
 */
export type FormattersPipelineTypedValueFormatNode = {
	id: string;
	type: "typedValueFormat";
	position: {
		x: number;
		y: number;
	};
	config?: FormattersPipelineTypedValueFormatConfig;
};

/**
 * Служебный узел входа.
 */
export type FormattersPipelineSourceNode = {
	id: string;
	type: "source";
	position: {
		x: number;
		y: number;
	};
};

/**
 * Служебный узел выхода.
 */
export type FormattersPipelineSinkNode = {
	id: string;
	type: "sink";
	position: {
		x: number;
		y: number;
	};
};

/**
 * Любой узел pipeline.
 */
export type FormattersPipelineNode =
	| FormattersPipelineSourceNode
	| FormattersPipelineSinkNode
	| FormattersPipelineNormalizeLeadingZerosNode
	| FormattersPipelineRowBasedOverrideNode
	| FormattersPipelineResolveValueStateNode
	| FormattersPipelineTypedValueFormatNode;

/**
 * Ребро графа pipeline.
 */
export type FormattersPipelineEdge = {
	id: string;
	source: string;
	target: string;
};

/**
 * Полный граф pipeline (вариант хранения для редактора).
 */
export type FormattersPipelineGraph = {
	nodes: FormattersPipelineNode[];
	edges: FormattersPipelineEdge[];
	viewport?: {
		x: number;
		y: number;
		zoom: number;
	};
};

/**
 * Линейный шаг плана исполнения `normalizeLeadingZeros`.
 */
export type FormattersPipelineNormalizeLeadingZerosStep = {
	id: string;
	type: "normalizeLeadingZeros";
	config?: FormattersPipelineNormalizeLeadingZerosConfig;
};

/**
 * Линейный шаг плана исполнения `rowBasedOverride`.
 */
export type FormattersPipelineRowBasedOverrideStep = {
	id: string;
	type: "rowBasedOverride";
	config: FormattersPipelineRowBasedOverrideConfig;
};

/**
 * Линейный шаг плана исполнения `resolveValueState`.
 */
export type FormattersPipelineResolveValueStateStep = {
	id: string;
	type: "resolveValueState";
	config: {
		resolver: FormattersPipelineValueStateResolverConfig;
		icon?: FormattersPipelineValueStateIconSettings;
	};
};

/**
 * Линейный шаг плана исполнения `typedValueFormat`.
 */
export type FormattersPipelineTypedValueFormatStep = {
	id: string;
	type: "typedValueFormat";
	config?: FormattersPipelineTypedValueFormatConfig;
};

/**
 * Любой шаг линейного плана.
 */
export type FormattersPipelineStep =
	| FormattersPipelineNormalizeLeadingZerosStep
	| FormattersPipelineRowBasedOverrideStep
	| FormattersPipelineResolveValueStateStep
	| FormattersPipelineTypedValueFormatStep;

/**
 * Облегчённый план исполнения (вариант хранения для runtime).
 */
export type FormattersPipelinePlan = {
	steps: FormattersPipelineStep[];
};

/**
 * Тип строки, в контексте которой исполняется pipeline.
 *
 * Исторически `rowBasedOverride` был придуман для analytical group-строк,
 * но generic-таблицы используют тот же шаг как row-based override.
 *
 * `rowBasedOverride` работает для обычных, tree- и analytical group-строк,
 * но не применяется к totals-строкам.
 */
export type FormattersPipelineRowKind = "plain" | "tree" | "group" | "totals";

/**
 * Конфигурация pipeline колонки.
 *
 * Поддерживается хранение:
 * - полного графа для редактора (`graph`);
 * - облегчённого линейного плана для runtime (`plan`).
 */
export type FormattersPipelineConfig = {
	version: 1;
	graph?: FormattersPipelineGraph;
	plan?: FormattersPipelinePlan;
};

/**
 * Контекст исполнения pipeline для конкретной ячейки.
 */
export type FormattersPipelineExecutionContext = {
	value: unknown;
	rowData: Record<string, unknown>;
	rowKind: FormattersPipelineRowKind;
	/**
	 * Совместимые производные флаги для legacy-кода.
	 *
	 * Новый код должен ориентироваться на `rowKind`.
	 *
	 * @deprecated analytical-table нужно адаптировать под rowKind
	 */
	isGroupRow: boolean;
	/**
	 * Совместимые производные флаги для legacy-кода.
	 *
	 * Новый код должен ориентироваться на `rowKind`.
	 *
	 * @deprecated analytical-table нужно адаптировать под rowKind
	 */
	isTotalsRow: boolean;
	rowLevel: number;
	groupingIds: readonly string[];
	columnId: string;
};

/**
 * Иконка, которая может быть показана рядом со значением.
 */
export type FormattersPipelineValueIcon = Exclude<State, "" | "none">;

/**
 * Результат исполнения pipeline.
 */
export type FormattersPipelineExecutionResult = {
	value: unknown;
	state: State;
	icon?: FormattersPipelineValueIcon;
	showIcon: boolean;
	showValue: boolean;
	iconPosition: FormattersPipelineIconPosition;
	hasTypedValueFormat: boolean;
};

/**
 * Скомпилированный executor pipeline конкретной колонки.
 */
export type FormattersPipelineExecutor = {
	execute: (ctx: FormattersPipelineExecutionContext) => FormattersPipelineExecutionResult;
	hasRowBasedOverride: boolean;
	hasTypedValueFormat: boolean;
};

/**
 * Runtime-контекст колонки для типизированного форматирования.
 */
export type FormattersPipelineTypedValueContext = {
	role: ColumnRole;
	type: ODataMetaType;
};

/**
 * Минимальный контракт поля, достаточный для runtime форматирования.
 *
 * Pipeline намеренно не знает про таблицы, графики, metadata-колонки или
 * UI-компоненты. Любой потребитель передаёт свой исходный объект, если он
 * содержит этот набор полей.
 */
export type FormattersPipelineRuntimeField = FormattersPipelineTypedValueContext & {
	/** Стабильный идентификатор поля в строке данных. */
	id: string;
	/** Сериализуемый конфиг pipeline-форматирования. */
	formattersPipeline?: FormattersPipelineConfig;
	/** Идентификатор формулы из реестра `shared/lib/formulas`. */
	formulaId?: string;
	/** Индексные зависимости формулы в порядке, в котором их читает `ctx.num(index)`. */
	formulaDependencies?: readonly string[];
	/** Признак чисто вычисляемого поля без безопасного fallback к raw value. */
	purelyDerived?: boolean;
	/** Признак, что нулевое значение после вычисления нужно скрывать как пустое. */
	emptyWhenZero?: boolean;
	/** Признак, что UI может показывать tooltip при переполнении значения. */
	overflowTooltip?: boolean;
	/** Скомпилированный executor формулы, заполняется на этапе сборки runtime. */
	formulaExecutor?: TableFormulaCompiledExecutor;
	/** Скомпилированный executor pipeline, заполняется на этапе сборки runtime. */
	formattersPipelineExecutor?: FormattersPipelineExecutor;
};

/**
 * Снимок runtime-полей по идентификаторам.
 *
 * Карта может создаваться заново, но сами поля остаются исходными объектами
 * потребителя и не пересобираются runtime-слоем.
 */
export type FormattersPipelineRuntimeFields<TField extends FormattersPipelineRuntimeField = FormattersPipelineRuntimeField> = Readonly<
	Record<string, Readonly<TField>>
>;

/**
 * Нормализованный display-result после формулы, pipeline и fallback-форматирования.
 */
export type FormattersPipelineDisplayValue = {
	/** Финальное значение, готовое к отрисовке. */
	value: unknown;
	/** Семантическое состояние значения. */
	state: State;
	/** Иконка состояния, если она нужна. */
	icon?: FormattersPipelineValueIcon;
	/** Нужно ли отрисовывать иконку. */
	showIcon: boolean;
	/** Нужно ли отрисовывать текстовое значение. */
	showValue: boolean;
	/** Позиция иконки относительно значения. */
	iconPosition: FormattersPipelineIconPosition;
	/** Разрешён ли tooltip переполнения. */
	overflowTooltip?: boolean;
};

/**
 * Аргументы вычисления display-result для одного поля.
 */
export type FormatPipelineDisplayValueArgs<TField extends FormattersPipelineRuntimeField = FormattersPipelineRuntimeField> = {
	/** Исходное runtime-поле потребителя. */
	field?: Readonly<TField>;
	/** Raw value до применения формулы и pipeline. */
	rawValue: unknown;
	/** Данные строки, доступные формуле и pipeline. */
	rowData: TableFormulaRowData;
	/** Тип строки, который определяет семантику `rowBasedOverride`. */
	rowKind: FormattersPipelineRowKind;
	/** Уровень строки, если потребитель поддерживает иерархию или группировку. */
	rowLevel?: number;
	/** Идентификаторы текущей группировки, если потребитель её поддерживает. */
	groupingIds?: readonly string[];
};

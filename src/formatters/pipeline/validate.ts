import { validateTableFormulaDependencies } from "../../formulas";
import {
	TABLE_FORMULA_NOT_FOUND,
	TABLE_FORMULA_DEPENDENCY_INDEX_OUT_OF_RANGE,
	TABLE_FORMULA_UNUSED_DEPENDENCIES,
	TABLE_FORMULA_DOES_NOT_USE_DEPENDENCIES,
	TABLE_FORMULA_VALIDATION_RUNTIME_ERROR
} from "../../formulas/tableFormulaConstants";
import { getNumberPreset } from "../number";
import { createRowBasedFormatterContext, getRowBasedFormatterById } from "../rowBased";
import { VALUE_STATE_RESOLVER_KIND_THRESHOLD } from "../valueState/valueStateResolverConstants";

import { cloneResolveValueStateConfig } from "./clone";
import {
	PIPELINE_FORMATTER_NORMALIZE_LEADING_ZEROS,
	PIPELINE_FORMATTER_ROW_BASED_OVERRIDE,
	PIPELINE_OVERRIDE_MODE_FIELD,
	PIPELINE_OVERRIDE_MODE_FORMULA,
	PIPELINE_FORMATTER_RESOLVE_VALUE_STATE,
	PIPELINE_FORMATTER_TYPED_VALUE_FORMAT,
	PIPELINE_NODE_SOURCE,
	PIPELINE_NODE_SINK,
	PIPELINE_STATE_SOURCE_FORMULA,
	FORMATTERS_PIPELINE_VERSION
} from "./formattersPipelineConstants";
import {
	PIPELINE_VALIDATION_CONFIG_NOT_DEFINED,
	PIPELINE_VALIDATION_UNSUPPORTED_VERSION,
	PIPELINE_VALIDATION_GRAPH_OR_PLAN_REQUIRED,
	PIPELINE_VALIDATION_NODE_ID_DUPLICATE,
	PIPELINE_VALIDATION_EDGE_ID_DUPLICATE,
	PIPELINE_VALIDATION_EDGE_NODE_NOT_FOUND,
	PIPELINE_VALIDATION_SOURCE_COUNT_INVALID,
	PIPELINE_VALIDATION_SINK_COUNT_INVALID,
	PIPELINE_VALIDATION_SOURCE_INCOMING_INVALID,
	PIPELINE_VALIDATION_SINK_OUTGOING_INVALID,
	PIPELINE_VALIDATION_NODE_DEGREE_INVALID,
	PIPELINE_VALIDATION_PATH_BROKEN,
	PIPELINE_VALIDATION_PATH_CYCLE_DETECTED,
	PIPELINE_VALIDATION_PATH_DISCONNECTED_NODES,
	PIPELINE_VALIDATION_STEP_ID_DUPLICATE,
	PIPELINE_VALIDATION_STEP_RESOLVE_VALUE_STATE_MULTIPLE,
	PIPELINE_VALIDATION_STEP_TYPED_VALUE_FORMAT_MULTIPLE,
	PIPELINE_VALIDATION_STEP_ROW_BASED_OVERRIDE_MULTIPLE,
	PIPELINE_VALIDATION_STEP_NORMALIZE_LEADING_ZEROS_MULTIPLE,
	PIPELINE_VALIDATION_STEP_TYPED_BEFORE_VALUE_STATE,
	PIPELINE_VALIDATION_STEP_ROW_BASED_OVERRIDE_FIELD_KEY_EMPTY,
	PIPELINE_VALIDATION_STEP_ROW_BASED_OVERRIDE_FORMULA_ID_EMPTY,
	PIPELINE_VALIDATION_STEP_ROW_BASED_OVERRIDE_FORMULA_NOT_FOUND,
	PIPELINE_VALIDATION_STEP_ROW_BASED_OVERRIDE_DEPENDENCY_INDEX_OUT_OF_RANGE,
	PIPELINE_VALIDATION_STEP_ROW_BASED_OVERRIDE_UNUSED_DEPENDENCIES,
	PIPELINE_VALIDATION_STEP_ROW_BASED_OVERRIDE_FORMULA_DOES_NOT_USE_DEPENDENCIES,
	PIPELINE_VALIDATION_STEP_ROW_BASED_OVERRIDE_FORMULA_RUNTIME_ERROR,
	PIPELINE_VALIDATION_STEP_VALUE_STATE_FORMULA_ID_EMPTY,
	PIPELINE_VALIDATION_STEP_VALUE_STATE_FORMULA_NOT_FOUND,
	PIPELINE_VALIDATION_STEP_VALUE_STATE_DEPENDENCY_ID_EMPTY,
	PIPELINE_VALIDATION_STEP_VALUE_STATE_DEPENDENCY_INDEX_OUT_OF_RANGE,
	PIPELINE_VALIDATION_STEP_VALUE_STATE_UNUSED_DEPENDENCIES,
	PIPELINE_VALIDATION_STEP_VALUE_STATE_FORMULA_DOES_NOT_USE_DEPENDENCIES,
	PIPELINE_VALIDATION_STEP_VALUE_STATE_FORMULA_RUNTIME_ERROR,
	PIPELINE_VALIDATION_STEP_THRESHOLD_STATES_COUNT_INVALID,
	PIPELINE_VALIDATION_STEP_VALUE_HIDDEN_WITHOUT_ICON,
	PIPELINE_VALIDATION_STEP_TYPED_VALUE_FORMAT_PRESET_EMPTY,
	PIPELINE_VALIDATION_STEP_TYPED_VALUE_FORMAT_PRESET_NOT_FOUND
} from "./pipelineValidationConstants";

import type {
	FormattersPipelineConfig,
	FormattersPipelineEdge,
	FormattersPipelineGraph,
	FormattersPipelineNode,
	FormattersPipelinePlan,
	FormattersPipelineRowBasedOverrideFormulaConfig,
	FormattersPipelineStep,
	FormattersPipelineValueStateFormulaSource
} from "./types";

/** Положительная и отрицательная пробы выявляют обращения к зависимостям в разных ветках формулы. */
const FORMULA_VALIDATION_PROBE_VALUE = 100;

export type FormattersPipelineValidationCode =
	| typeof PIPELINE_VALIDATION_CONFIG_NOT_DEFINED
	| typeof PIPELINE_VALIDATION_UNSUPPORTED_VERSION
	| typeof PIPELINE_VALIDATION_GRAPH_OR_PLAN_REQUIRED
	| typeof PIPELINE_VALIDATION_NODE_ID_DUPLICATE
	| typeof PIPELINE_VALIDATION_EDGE_ID_DUPLICATE
	| typeof PIPELINE_VALIDATION_EDGE_NODE_NOT_FOUND
	| typeof PIPELINE_VALIDATION_SOURCE_COUNT_INVALID
	| typeof PIPELINE_VALIDATION_SINK_COUNT_INVALID
	| typeof PIPELINE_VALIDATION_SOURCE_INCOMING_INVALID
	| typeof PIPELINE_VALIDATION_SINK_OUTGOING_INVALID
	| typeof PIPELINE_VALIDATION_NODE_DEGREE_INVALID
	| typeof PIPELINE_VALIDATION_PATH_BROKEN
	| typeof PIPELINE_VALIDATION_PATH_CYCLE_DETECTED
	| typeof PIPELINE_VALIDATION_PATH_DISCONNECTED_NODES
	| typeof PIPELINE_VALIDATION_STEP_ID_DUPLICATE
	| typeof PIPELINE_VALIDATION_STEP_RESOLVE_VALUE_STATE_MULTIPLE
	| typeof PIPELINE_VALIDATION_STEP_TYPED_VALUE_FORMAT_MULTIPLE
	| typeof PIPELINE_VALIDATION_STEP_ROW_BASED_OVERRIDE_MULTIPLE
	| typeof PIPELINE_VALIDATION_STEP_NORMALIZE_LEADING_ZEROS_MULTIPLE
	| typeof PIPELINE_VALIDATION_STEP_TYPED_BEFORE_VALUE_STATE
	| typeof PIPELINE_VALIDATION_STEP_ROW_BASED_OVERRIDE_FIELD_KEY_EMPTY
	| typeof PIPELINE_VALIDATION_STEP_ROW_BASED_OVERRIDE_FORMULA_ID_EMPTY
	| typeof PIPELINE_VALIDATION_STEP_ROW_BASED_OVERRIDE_FORMULA_NOT_FOUND
	| typeof PIPELINE_VALIDATION_STEP_ROW_BASED_OVERRIDE_DEPENDENCY_INDEX_OUT_OF_RANGE
	| typeof PIPELINE_VALIDATION_STEP_ROW_BASED_OVERRIDE_UNUSED_DEPENDENCIES
	| typeof PIPELINE_VALIDATION_STEP_ROW_BASED_OVERRIDE_FORMULA_DOES_NOT_USE_DEPENDENCIES
	| typeof PIPELINE_VALIDATION_STEP_ROW_BASED_OVERRIDE_FORMULA_RUNTIME_ERROR
	| typeof PIPELINE_VALIDATION_STEP_VALUE_STATE_FORMULA_ID_EMPTY
	| typeof PIPELINE_VALIDATION_STEP_VALUE_STATE_FORMULA_NOT_FOUND
	| typeof PIPELINE_VALIDATION_STEP_VALUE_STATE_DEPENDENCY_ID_EMPTY
	| typeof PIPELINE_VALIDATION_STEP_VALUE_STATE_DEPENDENCY_INDEX_OUT_OF_RANGE
	| typeof PIPELINE_VALIDATION_STEP_VALUE_STATE_UNUSED_DEPENDENCIES
	| typeof PIPELINE_VALIDATION_STEP_VALUE_STATE_FORMULA_DOES_NOT_USE_DEPENDENCIES
	| typeof PIPELINE_VALIDATION_STEP_VALUE_STATE_FORMULA_RUNTIME_ERROR
	| typeof PIPELINE_VALIDATION_STEP_THRESHOLD_STATES_COUNT_INVALID
	| typeof PIPELINE_VALIDATION_STEP_VALUE_HIDDEN_WITHOUT_ICON
	| typeof PIPELINE_VALIDATION_STEP_TYPED_VALUE_FORMAT_PRESET_EMPTY
	| typeof PIPELINE_VALIDATION_STEP_TYPED_VALUE_FORMAT_PRESET_NOT_FOUND;

export type FormattersPipelineValidationMessage = {
	code: FormattersPipelineValidationCode;
	message: string;
};

export type FormattersPipelineValidationResult = {
	ok: boolean;
	errors: FormattersPipelineValidationMessage[];
	warnings: FormattersPipelineValidationMessage[];
	plan?: FormattersPipelinePlan;
};

type MutableValidationState = {
	errors: FormattersPipelineValidationMessage[];
	warnings: FormattersPipelineValidationMessage[];
};

function pushError(state: MutableValidationState, code: FormattersPipelineValidationCode, message: string) {
	state.errors.push({ code, message });
}

function pushWarning(state: MutableValidationState, code: FormattersPipelineValidationCode, message: string) {
	state.warnings.push({ code, message });
}

function toSortedArray(items: Set<number>): number[] {
	return [...items].sort((left, right) => left - right);
}

function createSampleRowData(dependencies: readonly string[], multiplier: number): Record<string, unknown> {
	return dependencies.reduce<Record<string, unknown>>((acc, dependencyId, index) => {
		acc[dependencyId] = (index + 1) * multiplier;
		return acc;
	}, {});
}

function validateRowBasedOverrideFormulaConfig(config: FormattersPipelineRowBasedOverrideFormulaConfig, state: MutableValidationState) {
	if (!config.formulaId.trim()) {
		pushError(
			state,
			PIPELINE_VALIDATION_STEP_ROW_BASED_OVERRIDE_FORMULA_ID_EMPTY,
			"Для rowBasedOverride (formula) необходимо заполнить formulaId."
		);
		return;
	}

	const formula = getRowBasedFormatterById(config.formulaId);
	const dependencies = [...(config.dependencyIds ?? [])];

	if (!formula) {
		pushError(state, PIPELINE_VALIDATION_STEP_ROW_BASED_OVERRIDE_FORMULA_NOT_FOUND, "Формула rowBasedOverride не найдена в реестре.");
		return;
	}

	const usedIndexes = new Set<number>();
	const outOfRangeIndexes = new Set<number>();
	let runtimeErrorCount = 0;

	const runValidationPass = (sampleRowData: Record<string, unknown>) => {
		try {
			const context = createRowBasedFormatterContext({
				rowData: sampleRowData,
				rawValue: FORMULA_VALIDATION_PROBE_VALUE,
				columnId: "__validation__",
				keys: dependencies,
				instrumentation: {
					onReadIndex: (index) => {
						usedIndexes.add(index);
					},
					onOutOfRangeIndex: (index) => {
						outOfRangeIndexes.add(index);
					}
				}
			});
			formula.fn(context);
		} catch {
			runtimeErrorCount += 1;
		}
	};

	// Несколько прогонов повышают шанс увидеть обращения к индексам в разных ветках формулы.
	runValidationPass(createSampleRowData(dependencies, FORMULA_VALIDATION_PROBE_VALUE));
	runValidationPass(createSampleRowData(dependencies, -FORMULA_VALIDATION_PROBE_VALUE));

	const sortedUsedIndexes = toSortedArray(usedIndexes);
	const requiredDependencyCount = sortedUsedIndexes.length > 0 ? sortedUsedIndexes[sortedUsedIndexes.length - 1] + 1 : 0;

	if (outOfRangeIndexes.size > 0) {
		pushError(
			state,
			PIPELINE_VALIDATION_STEP_ROW_BASED_OVERRIDE_DEPENDENCY_INDEX_OUT_OF_RANGE,
			`Формула rowBasedOverride обращается к несуществующим индексам. Минимально требуется зависимостей: ${requiredDependencyCount}, выбрано: ${dependencies.length}.`
		);
	}

	if (sortedUsedIndexes.length === 0) {
		pushWarning(
			state,
			PIPELINE_VALIDATION_STEP_ROW_BASED_OVERRIDE_FORMULA_DOES_NOT_USE_DEPENDENCIES,
			"Формула rowBasedOverride не использует dependencyIds."
		);
	}

	const unusedDependencies = dependencies.filter((_, index) => !usedIndexes.has(index));
	if (unusedDependencies.length > 0) {
		pushWarning(
			state,
			PIPELINE_VALIDATION_STEP_ROW_BASED_OVERRIDE_UNUSED_DEPENDENCIES,
			`Выбраны, но не используются формулой rowBasedOverride: ${unusedDependencies.join(", ")}.`
		);
	}

	if (runtimeErrorCount > 0) {
		pushWarning(
			state,
			PIPELINE_VALIDATION_STEP_ROW_BASED_OVERRIDE_FORMULA_RUNTIME_ERROR,
			"На тестовых данных формула rowBasedOverride завершилась с ошибкой."
		);
	}
}

/**
 * Pipeline проверяет контракт формулы и индексы, а наличие полей в конкретном
 * источнике данных проверяет потребитель через collectRuntimeFieldDependencyIds.
 */
function validateValueStateFormulaSource(source: FormattersPipelineValueStateFormulaSource, state: MutableValidationState) {
	if (!source.formulaId.trim()) {
		pushError(state, PIPELINE_VALIDATION_STEP_VALUE_STATE_FORMULA_ID_EMPTY, "Для источника состояния необходимо выбрать формулу.");
		return;
	}

	if (source.dependencyIds.some((dependencyId) => !dependencyId.trim())) {
		pushError(
			state,
			PIPELINE_VALIDATION_STEP_VALUE_STATE_DEPENDENCY_ID_EMPTY,
			"Зависимость формулы состояния не может иметь пустой id."
		);
		return;
	}

	const validation = validateTableFormulaDependencies({
		formulaId: source.formulaId,
		dependencies: source.dependencyIds,
		availableColumnIds: source.dependencyIds
	});
	for (const error of validation.errors) {
		if (error.code === TABLE_FORMULA_NOT_FOUND) {
			pushError(state, PIPELINE_VALIDATION_STEP_VALUE_STATE_FORMULA_NOT_FOUND, "Формула источника состояния не найдена в реестре.");
		} else if (error.code === TABLE_FORMULA_DEPENDENCY_INDEX_OUT_OF_RANGE) {
			pushError(state, PIPELINE_VALIDATION_STEP_VALUE_STATE_DEPENDENCY_INDEX_OUT_OF_RANGE, error.message);
		}
	}
	for (const warning of validation.warnings) {
		switch (warning.code) {
			case TABLE_FORMULA_UNUSED_DEPENDENCIES:
				pushWarning(state, PIPELINE_VALIDATION_STEP_VALUE_STATE_UNUSED_DEPENDENCIES, warning.message);
				break;
			case TABLE_FORMULA_DOES_NOT_USE_DEPENDENCIES:
				pushWarning(state, PIPELINE_VALIDATION_STEP_VALUE_STATE_FORMULA_DOES_NOT_USE_DEPENDENCIES, warning.message);
				break;
			case TABLE_FORMULA_VALIDATION_RUNTIME_ERROR:
				pushWarning(state, PIPELINE_VALIDATION_STEP_VALUE_STATE_FORMULA_RUNTIME_ERROR, warning.message);
				break;
		}
	}
}

function validateStepDefinitions(steps: readonly FormattersPipelineStep[], state: MutableValidationState) {
	const stepIdSet = new Set<string>();
	const counters = {
		normalizeLeadingZeros: 0,
		rowBasedOverride: 0,
		resolveValueState: 0,
		typedValueFormat: 0
	};

	for (const step of steps) {
		const normalizedId = step.id.trim();
		if (!normalizedId) {
			pushError(state, PIPELINE_VALIDATION_STEP_ID_DUPLICATE, "Шаг pipeline не может иметь пустой id.");
			continue;
		}

		if (stepIdSet.has(normalizedId)) {
			pushError(state, PIPELINE_VALIDATION_STEP_ID_DUPLICATE, `Найден дублирующийся id шага pipeline: ${normalizedId}.`);
		}
		stepIdSet.add(normalizedId);

		switch (step.type) {
			case PIPELINE_FORMATTER_NORMALIZE_LEADING_ZEROS:
				counters.normalizeLeadingZeros += 1;
				break;
			case PIPELINE_FORMATTER_ROW_BASED_OVERRIDE:
				counters.rowBasedOverride += 1;

				if (step.config.mode === PIPELINE_OVERRIDE_MODE_FIELD && !step.config.fieldKey.trim()) {
					pushError(
						state,
						PIPELINE_VALIDATION_STEP_ROW_BASED_OVERRIDE_FIELD_KEY_EMPTY,
						"Для rowBasedOverride (field) необходимо заполнить fieldKey."
					);
				}

				if (step.config.mode === PIPELINE_OVERRIDE_MODE_FORMULA) {
					validateRowBasedOverrideFormulaConfig(step.config, state);
				}
				break;
			case PIPELINE_FORMATTER_RESOLVE_VALUE_STATE:
				counters.resolveValueState += 1;
				if (step.config.valueSource?.kind === PIPELINE_STATE_SOURCE_FORMULA) {
					validateValueStateFormulaSource(step.config.valueSource, state);
				}

				if (
					step.config.resolver.kind === VALUE_STATE_RESOLVER_KIND_THRESHOLD &&
					step.config.resolver.states.length !== step.config.resolver.thresholds.length + 1
				) {
					pushError(
						state,
						PIPELINE_VALIDATION_STEP_THRESHOLD_STATES_COUNT_INVALID,
						"Для threshold-резолвера количество states должно быть равно thresholds + 1."
					);
				}
				break;
			case PIPELINE_FORMATTER_TYPED_VALUE_FORMAT:
				counters.typedValueFormat += 1;
				if (step.config?.numberPresetName !== undefined) {
					const normalizedPresetName = step.config.numberPresetName.trim();
					if (!normalizedPresetName) {
						pushError(
							state,
							PIPELINE_VALIDATION_STEP_TYPED_VALUE_FORMAT_PRESET_EMPTY,
							"Для typedValueFormat указан пустой numberPresetName."
						);
						break;
					}

					if (!getNumberPreset(normalizedPresetName)) {
						pushError(
							state,
							PIPELINE_VALIDATION_STEP_TYPED_VALUE_FORMAT_PRESET_NOT_FOUND,
							`Для typedValueFormat указан неизвестный пресет: ${normalizedPresetName}.`
						);
					}
				}
				break;
		}
	}

	if (counters.normalizeLeadingZeros > 1) {
		pushError(
			state,
			PIPELINE_VALIDATION_STEP_NORMALIZE_LEADING_ZEROS_MULTIPLE,
			"В pipeline может быть только один шаг normalizeLeadingZeros."
		);
	}

	if (counters.rowBasedOverride > 1) {
		pushError(state, PIPELINE_VALIDATION_STEP_ROW_BASED_OVERRIDE_MULTIPLE, "В pipeline может быть только один шаг rowBasedOverride.");
	}

	if (counters.resolveValueState > 1) {
		pushError(state, PIPELINE_VALIDATION_STEP_RESOLVE_VALUE_STATE_MULTIPLE, "В pipeline может быть только один шаг resolveValueState.");
	}

	if (counters.typedValueFormat > 1) {
		pushError(state, PIPELINE_VALIDATION_STEP_TYPED_VALUE_FORMAT_MULTIPLE, "В pipeline может быть только один шаг typedValueFormat.");
	}

	const resolveIndex = steps.findIndex((step) => step.type === PIPELINE_FORMATTER_RESOLVE_VALUE_STATE);
	const typedIndex = steps.findIndex((step) => step.type === PIPELINE_FORMATTER_TYPED_VALUE_FORMAT);
	if (resolveIndex !== -1 && typedIndex !== -1 && typedIndex < resolveIndex) {
		pushError(
			state,
			PIPELINE_VALIDATION_STEP_TYPED_BEFORE_VALUE_STATE,
			"Шаг typedValueFormat не может выполняться до шага resolveValueState."
		);
	}

	for (const step of steps) {
		if (step.type !== PIPELINE_FORMATTER_RESOLVE_VALUE_STATE) continue;
		if (!step.config.icon?.enabled && step.config.icon?.showValue === false) {
			pushWarning(
				state,
				PIPELINE_VALIDATION_STEP_VALUE_HIDDEN_WITHOUT_ICON,
				"Для resolveValueState установлено showValue=false при выключенной иконке: значение не будет отображаться."
			);
		}
	}
}

/**
 * Валидация облегчённого плана pipeline.
 */
export function validateFormattersPipelinePlan(plan: FormattersPipelinePlan): FormattersPipelineValidationResult {
	const state: MutableValidationState = { errors: [], warnings: [] };

	validateStepDefinitions(plan.steps, state);

	return {
		ok: state.errors.length === 0,
		errors: state.errors,
		warnings: state.warnings,
		plan: state.errors.length === 0 ? { steps: [...plan.steps] } : undefined
	};
}

function buildLinearPathFromGraph(
	nodes: readonly FormattersPipelineNode[],
	edges: readonly FormattersPipelineEdge[],
	state: MutableValidationState
): string[] | undefined {
	const nodeById = new Map(nodes.map((node) => [node.id, node]));
	const outgoing = new Map<string, string[]>();
	const incoming = new Map<string, string[]>();

	for (const node of nodes) {
		outgoing.set(node.id, []);
		incoming.set(node.id, []);
	}

	for (const edge of edges) {
		const source = edge.source.trim();
		const target = edge.target.trim();
		if (!nodeById.has(source) || !nodeById.has(target)) {
			pushError(
				state,
				PIPELINE_VALIDATION_EDGE_NODE_NOT_FOUND,
				`Ребро ${edge.id} ссылается на несуществующий узел: ${source} -> ${target}.`
			);
			continue;
		}

		outgoing.get(source)?.push(target);
		incoming.get(target)?.push(source);
	}

	const sources = nodes.filter((node) => node.type === PIPELINE_NODE_SOURCE);
	const sinks = nodes.filter((node) => node.type === PIPELINE_NODE_SINK);

	if (sources.length !== 1) {
		pushError(state, PIPELINE_VALIDATION_SOURCE_COUNT_INVALID, "В графе должен быть ровно один узел source.");
	}
	if (sinks.length !== 1) {
		pushError(state, PIPELINE_VALIDATION_SINK_COUNT_INVALID, "В графе должен быть ровно один узел sink.");
	}
	if (state.errors.length > 0) return undefined;

	const sourceNodeId = sources[0]!.id;
	const sinkNodeId = sinks[0]!.id;

	for (const node of nodes) {
		const inDegree = incoming.get(node.id)?.length ?? 0;
		const outDegree = outgoing.get(node.id)?.length ?? 0;

		if (node.type === PIPELINE_NODE_SOURCE) {
			if (inDegree !== 0) {
				pushError(state, PIPELINE_VALIDATION_SOURCE_INCOMING_INVALID, "Узел source не должен иметь входящих рёбер.");
			}
			if (outDegree !== 1) {
				pushError(state, PIPELINE_VALIDATION_NODE_DEGREE_INVALID, "Узел source должен иметь ровно одно исходящее ребро.");
			}
			continue;
		}

		if (node.type === PIPELINE_NODE_SINK) {
			if (outDegree !== 0) {
				pushError(state, PIPELINE_VALIDATION_SINK_OUTGOING_INVALID, "Узел sink не должен иметь исходящих рёбер.");
			}
			if (inDegree !== 1) {
				pushError(state, PIPELINE_VALIDATION_NODE_DEGREE_INVALID, "Узел sink должен иметь ровно одно входящее ребро.");
			}
			continue;
		}

		if (inDegree !== 1 || outDegree !== 1) {
			pushError(
				state,
				PIPELINE_VALIDATION_NODE_DEGREE_INVALID,
				`Узел ${node.id} должен иметь ровно одно входящее и одно исходящее ребро для линейного pipeline.`
			);
		}
	}

	if (state.errors.length > 0) return undefined;

	const visited = new Set<string>();
	const path: string[] = [];
	let cursor = sourceNodeId;

	while (true) {
		if (visited.has(cursor)) {
			pushError(state, PIPELINE_VALIDATION_PATH_CYCLE_DETECTED, "В графе pipeline обнаружен цикл.");
			return undefined;
		}
		visited.add(cursor);
		path.push(cursor);

		if (cursor === sinkNodeId) {
			break;
		}

		const nextCandidates = outgoing.get(cursor) ?? [];
		if (nextCandidates.length !== 1) {
			pushError(state, PIPELINE_VALIDATION_PATH_BROKEN, "Не удалось построить линейный путь от source к sink.");
			return undefined;
		}

		cursor = nextCandidates[0]!;
	}

	if (visited.size !== nodes.length) {
		pushError(
			state,
			PIPELINE_VALIDATION_PATH_DISCONNECTED_NODES,
			"Граф содержит узлы, которые не входят в линейный путь source -> sink."
		);
		return undefined;
	}

	return path;
}

/**
 * Валидация графа pipeline и построение линейного плана исполнения.
 */
export function validateFormattersPipelineGraph(graph: FormattersPipelineGraph): FormattersPipelineValidationResult {
	const state: MutableValidationState = { errors: [], warnings: [] };

	if (!graph.nodes.length) {
		pushError(state, PIPELINE_VALIDATION_PATH_BROKEN, "Граф pipeline не содержит узлов.");
		return { ok: false, errors: state.errors, warnings: state.warnings };
	}

	const nodeById = new Map<string, FormattersPipelineNode>();
	for (const node of graph.nodes) {
		const normalizedId = node.id.trim();
		if (!normalizedId) {
			pushError(state, PIPELINE_VALIDATION_NODE_ID_DUPLICATE, "Узел pipeline не может иметь пустой id.");
			continue;
		}

		if (nodeById.has(normalizedId)) {
			pushError(state, PIPELINE_VALIDATION_NODE_ID_DUPLICATE, `Найден дублирующийся id узла pipeline: ${normalizedId}.`);
			continue;
		}

		nodeById.set(normalizedId, node);
	}

	const edgeIdSet = new Set<string>();
	for (const edge of graph.edges) {
		const normalizedEdgeId = edge.id.trim();
		if (!normalizedEdgeId) {
			pushError(state, PIPELINE_VALIDATION_EDGE_ID_DUPLICATE, "Ребро pipeline не может иметь пустой id.");
			continue;
		}

		if (edgeIdSet.has(normalizedEdgeId)) {
			pushError(state, PIPELINE_VALIDATION_EDGE_ID_DUPLICATE, `Найден дублирующийся id ребра pipeline: ${normalizedEdgeId}.`);
			continue;
		}

		edgeIdSet.add(normalizedEdgeId);
	}

	if (state.errors.length > 0) {
		return {
			ok: false,
			errors: state.errors,
			warnings: state.warnings
		};
	}

	const path = buildLinearPathFromGraph(graph.nodes, graph.edges, state);
	if (!path) {
		return {
			ok: false,
			errors: state.errors,
			warnings: state.warnings
		};
	}

	const steps: FormattersPipelineStep[] = [];
	for (const nodeId of path) {
		const node = nodeById.get(nodeId);
		if (!node || node.type === PIPELINE_NODE_SOURCE || node.type === PIPELINE_NODE_SINK) continue;

		switch (node.type) {
			case PIPELINE_FORMATTER_NORMALIZE_LEADING_ZEROS:
				steps.push({
					id: node.id,
					type: PIPELINE_FORMATTER_NORMALIZE_LEADING_ZEROS,
					config: node.config ? { ...node.config } : undefined
				});
				break;
			case PIPELINE_FORMATTER_ROW_BASED_OVERRIDE:
				steps.push({
					id: node.id,
					type: PIPELINE_FORMATTER_ROW_BASED_OVERRIDE,
					config:
						node.config.mode === PIPELINE_OVERRIDE_MODE_FORMULA
							? { ...node.config, dependencyIds: node.config.dependencyIds ? [...node.config.dependencyIds] : undefined }
							: { ...node.config }
				});
				break;
			case PIPELINE_FORMATTER_RESOLVE_VALUE_STATE:
				steps.push({
					id: node.id,
					type: PIPELINE_FORMATTER_RESOLVE_VALUE_STATE,
					config: cloneResolveValueStateConfig(node.config)
				});
				break;
			case PIPELINE_FORMATTER_TYPED_VALUE_FORMAT:
				steps.push({
					id: node.id,
					type: PIPELINE_FORMATTER_TYPED_VALUE_FORMAT,
					config: node.config ? { ...node.config } : undefined
				});
				break;
		}
	}

	validateStepDefinitions(steps, state);

	return {
		ok: state.errors.length === 0,
		errors: state.errors,
		warnings: state.warnings,
		plan: state.errors.length === 0 ? { steps } : undefined
	};
}

/**
 * Валидация конфигурации pipeline c выбором рабочего плана исполнения.
 *
 * Приоритет источника плана:
 * 1) `plan` из конфигурации;
 * 2) построение плана из `graph`.
 */
export function validateFormattersPipelineConfig(config: FormattersPipelineConfig | undefined): FormattersPipelineValidationResult {
	const state: MutableValidationState = { errors: [], warnings: [] };

	if (!config) {
		pushError(state, PIPELINE_VALIDATION_CONFIG_NOT_DEFINED, "Конфигурация pipeline не задана.");
		return {
			ok: false,
			errors: state.errors,
			warnings: state.warnings
		};
	}

	if (config.version !== FORMATTERS_PIPELINE_VERSION) {
		pushError(state, PIPELINE_VALIDATION_UNSUPPORTED_VERSION, `Неподдерживаемая версия pipeline: ${String(config.version)}.`);
		return {
			ok: false,
			errors: state.errors,
			warnings: state.warnings
		};
	}

	if (!config.plan && !config.graph) {
		pushError(
			state,
			PIPELINE_VALIDATION_GRAPH_OR_PLAN_REQUIRED,
			"Для pipeline должен быть задан хотя бы один источник: graph или plan."
		);
		return {
			ok: false,
			errors: state.errors,
			warnings: state.warnings
		};
	}

	if (config.plan) {
		const planResult = validateFormattersPipelinePlan(config.plan);
		state.errors.push(...planResult.errors);
		state.warnings.push(...planResult.warnings);

		if (planResult.ok && planResult.plan) {
			return {
				ok: true,
				errors: state.errors,
				warnings: state.warnings,
				plan: planResult.plan
			};
		}

		if (config.graph) {
			pushWarning(state, PIPELINE_VALIDATION_PATH_BROKEN, "Линейный plan невалиден. Выполнена попытка построить план из graph.");
			state.errors.length = 0;
		} else {
			return {
				ok: false,
				errors: state.errors,
				warnings: state.warnings
			};
		}
	}

	if (config.graph) {
		const graphResult = validateFormattersPipelineGraph(config.graph);
		return {
			ok: graphResult.ok,
			errors: [...state.errors, ...graphResult.errors],
			warnings: [...state.warnings, ...graphResult.warnings],
			plan: graphResult.plan
		};
	}

	return {
		ok: false,
		errors: state.errors,
		warnings: state.warnings
	};
}

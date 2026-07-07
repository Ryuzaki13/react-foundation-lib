import { getNumberPreset } from "../number";
import { createRowBasedFormatterContext, getRowBasedFormatterById } from "../rowBased";

import type {
	FormattersPipelineConfig,
	FormattersPipelineEdge,
	FormattersPipelineGraph,
	FormattersPipelineNode,
	FormattersPipelinePlan,
	FormattersPipelineRowBasedOverrideFormulaConfig,
	FormattersPipelineStep
} from "./types";

export type FormattersPipelineValidationCode =
	| "config_not_defined"
	| "unsupported_version"
	| "graph_or_plan_required"
	| "node_id_duplicate"
	| "edge_id_duplicate"
	| "edge_node_not_found"
	| "source_count_invalid"
	| "sink_count_invalid"
	| "source_incoming_invalid"
	| "sink_outgoing_invalid"
	| "node_degree_invalid"
	| "path_broken"
	| "path_cycle_detected"
	| "path_disconnected_nodes"
	| "step_id_duplicate"
	| "step_resolve_value_state_multiple"
	| "step_typed_value_format_multiple"
	| "step_row_based_override_multiple"
	| "step_normalize_leading_zeros_multiple"
	| "step_typed_before_value_state"
	| "step_row_based_override_field_key_empty"
	| "step_row_based_override_formula_id_empty"
	| "step_row_based_override_formula_not_found"
	| "step_row_based_override_dependency_index_out_of_range"
	| "step_row_based_override_unused_dependencies"
	| "step_row_based_override_formula_does_not_use_dependencies"
	| "step_row_based_override_formula_runtime_error"
	| "step_threshold_states_count_invalid"
	| "step_value_hidden_without_icon"
	| "step_typed_value_format_preset_empty"
	| "step_typed_value_format_preset_not_found";

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
		pushError(state, "step_row_based_override_formula_id_empty", "Для rowBasedOverride (formula) необходимо заполнить formulaId.");
		return;
	}

	const formula = getRowBasedFormatterById(config.formulaId);
	const dependencies = [...(config.dependencyIds ?? [])];

	if (!formula) {
		pushError(state, "step_row_based_override_formula_not_found", "Формула rowBasedOverride не найдена в реестре.");
		return;
	}

	const usedIndexes = new Set<number>();
	const outOfRangeIndexes = new Set<number>();
	let runtimeErrorCount = 0;

	const runValidationPass = (sampleRowData: Record<string, unknown>) => {
		try {
			const context = createRowBasedFormatterContext({
				rowData: sampleRowData,
				rawValue: 100,
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
	runValidationPass(createSampleRowData(dependencies, 100));
	runValidationPass(createSampleRowData(dependencies, -100));

	const sortedUsedIndexes = toSortedArray(usedIndexes);
	const requiredDependencyCount = sortedUsedIndexes.length > 0 ? sortedUsedIndexes[sortedUsedIndexes.length - 1] + 1 : 0;

	if (outOfRangeIndexes.size > 0) {
		pushError(
			state,
			"step_row_based_override_dependency_index_out_of_range",
			`Формула rowBasedOverride обращается к несуществующим индексам. Минимально требуется зависимостей: ${requiredDependencyCount}, выбрано: ${dependencies.length}.`
		);
	}

	if (sortedUsedIndexes.length === 0) {
		pushWarning(
			state,
			"step_row_based_override_formula_does_not_use_dependencies",
			"Формула rowBasedOverride не использует dependencyIds."
		);
	}

	const unusedDependencies = dependencies.filter((_, index) => !usedIndexes.has(index));
	if (unusedDependencies.length > 0) {
		pushWarning(
			state,
			"step_row_based_override_unused_dependencies",
			`Выбраны, но не используются формулой rowBasedOverride: ${unusedDependencies.join(", ")}.`
		);
	}

	if (runtimeErrorCount > 0) {
		pushWarning(
			state,
			"step_row_based_override_formula_runtime_error",
			"На тестовых данных формула rowBasedOverride завершилась с ошибкой."
		);
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
			pushError(state, "step_id_duplicate", "Шаг pipeline не может иметь пустой id.");
			continue;
		}

		if (stepIdSet.has(normalizedId)) {
			pushError(state, "step_id_duplicate", `Найден дублирующийся id шага pipeline: ${normalizedId}.`);
		}
		stepIdSet.add(normalizedId);

		switch (step.type) {
			case "normalizeLeadingZeros":
				counters.normalizeLeadingZeros += 1;
				break;
			case "rowBasedOverride":
				counters.rowBasedOverride += 1;

				if (step.config.mode === "field" && !step.config.fieldKey.trim()) {
					pushError(
						state,
						"step_row_based_override_field_key_empty",
						"Для rowBasedOverride (field) необходимо заполнить fieldKey."
					);
				}

				if (step.config.mode === "formula") {
					validateRowBasedOverrideFormulaConfig(step.config, state);
				}
				break;
			case "resolveValueState":
				counters.resolveValueState += 1;

				if (
					step.config.resolver.kind === "threshold" &&
					step.config.resolver.states.length !== step.config.resolver.thresholds.length + 1
				) {
					pushError(
						state,
						"step_threshold_states_count_invalid",
						"Для threshold-резолвера количество states должно быть равно thresholds + 1."
					);
				}
				break;
			case "typedValueFormat":
				counters.typedValueFormat += 1;
				if (step.config?.numberPresetName !== undefined) {
					const normalizedPresetName = step.config.numberPresetName.trim();
					if (!normalizedPresetName) {
						pushError(state, "step_typed_value_format_preset_empty", "Для typedValueFormat указан пустой numberPresetName.");
						break;
					}

					if (!getNumberPreset(normalizedPresetName)) {
						pushError(
							state,
							"step_typed_value_format_preset_not_found",
							`Для typedValueFormat указан неизвестный пресет: ${normalizedPresetName}.`
						);
					}
				}
				break;
		}
	}

	if (counters.normalizeLeadingZeros > 1) {
		pushError(state, "step_normalize_leading_zeros_multiple", "В pipeline может быть только один шаг normalizeLeadingZeros.");
	}

	if (counters.rowBasedOverride > 1) {
		pushError(state, "step_row_based_override_multiple", "В pipeline может быть только один шаг rowBasedOverride.");
	}

	if (counters.resolveValueState > 1) {
		pushError(state, "step_resolve_value_state_multiple", "В pipeline может быть только один шаг resolveValueState.");
	}

	if (counters.typedValueFormat > 1) {
		pushError(state, "step_typed_value_format_multiple", "В pipeline может быть только один шаг typedValueFormat.");
	}

	const resolveIndex = steps.findIndex((step) => step.type === "resolveValueState");
	const typedIndex = steps.findIndex((step) => step.type === "typedValueFormat");
	if (resolveIndex !== -1 && typedIndex !== -1 && typedIndex < resolveIndex) {
		pushError(state, "step_typed_before_value_state", "Шаг typedValueFormat не может выполняться до шага resolveValueState.");
	}

	for (const step of steps) {
		if (step.type !== "resolveValueState") continue;
		if (!step.config.icon?.enabled && step.config.icon?.showValue === false) {
			pushWarning(
				state,
				"step_value_hidden_without_icon",
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
			pushError(state, "edge_node_not_found", `Ребро ${edge.id} ссылается на несуществующий узел: ${source} -> ${target}.`);
			continue;
		}

		outgoing.get(source)?.push(target);
		incoming.get(target)?.push(source);
	}

	const sources = nodes.filter((node) => node.type === "source");
	const sinks = nodes.filter((node) => node.type === "sink");

	if (sources.length !== 1) {
		pushError(state, "source_count_invalid", "В графе должен быть ровно один узел source.");
	}
	if (sinks.length !== 1) {
		pushError(state, "sink_count_invalid", "В графе должен быть ровно один узел sink.");
	}
	if (state.errors.length > 0) return undefined;

	const sourceNodeId = sources[0]!.id;
	const sinkNodeId = sinks[0]!.id;

	for (const node of nodes) {
		const inDegree = incoming.get(node.id)?.length ?? 0;
		const outDegree = outgoing.get(node.id)?.length ?? 0;

		if (node.type === "source") {
			if (inDegree !== 0) {
				pushError(state, "source_incoming_invalid", "Узел source не должен иметь входящих рёбер.");
			}
			if (outDegree !== 1) {
				pushError(state, "node_degree_invalid", "Узел source должен иметь ровно одно исходящее ребро.");
			}
			continue;
		}

		if (node.type === "sink") {
			if (outDegree !== 0) {
				pushError(state, "sink_outgoing_invalid", "Узел sink не должен иметь исходящих рёбер.");
			}
			if (inDegree !== 1) {
				pushError(state, "node_degree_invalid", "Узел sink должен иметь ровно одно входящее ребро.");
			}
			continue;
		}

		if (inDegree !== 1 || outDegree !== 1) {
			pushError(
				state,
				"node_degree_invalid",
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
			pushError(state, "path_cycle_detected", "В графе pipeline обнаружен цикл.");
			return undefined;
		}
		visited.add(cursor);
		path.push(cursor);

		if (cursor === sinkNodeId) {
			break;
		}

		const nextCandidates = outgoing.get(cursor) ?? [];
		if (nextCandidates.length !== 1) {
			pushError(state, "path_broken", "Не удалось построить линейный путь от source к sink.");
			return undefined;
		}

		cursor = nextCandidates[0]!;
	}

	if (visited.size !== nodes.length) {
		pushError(state, "path_disconnected_nodes", "Граф содержит узлы, которые не входят в линейный путь source -> sink.");
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
		pushError(state, "path_broken", "Граф pipeline не содержит узлов.");
		return { ok: false, errors: state.errors, warnings: state.warnings };
	}

	const nodeById = new Map<string, FormattersPipelineNode>();
	for (const node of graph.nodes) {
		const normalizedId = node.id.trim();
		if (!normalizedId) {
			pushError(state, "node_id_duplicate", "Узел pipeline не может иметь пустой id.");
			continue;
		}

		if (nodeById.has(normalizedId)) {
			pushError(state, "node_id_duplicate", `Найден дублирующийся id узла pipeline: ${normalizedId}.`);
			continue;
		}

		nodeById.set(normalizedId, node);
	}

	const edgeIdSet = new Set<string>();
	for (const edge of graph.edges) {
		const normalizedEdgeId = edge.id.trim();
		if (!normalizedEdgeId) {
			pushError(state, "edge_id_duplicate", "Ребро pipeline не может иметь пустой id.");
			continue;
		}

		if (edgeIdSet.has(normalizedEdgeId)) {
			pushError(state, "edge_id_duplicate", `Найден дублирующийся id ребра pipeline: ${normalizedEdgeId}.`);
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
		if (!node || node.type === "source" || node.type === "sink") continue;

		switch (node.type) {
			case "normalizeLeadingZeros":
				steps.push({
					id: node.id,
					type: "normalizeLeadingZeros",
					config: node.config ? { ...node.config } : undefined
				});
				break;
			case "rowBasedOverride":
				steps.push({
					id: node.id,
					type: "rowBasedOverride",
					config:
						node.config.mode === "formula"
							? { ...node.config, dependencyIds: node.config.dependencyIds ? [...node.config.dependencyIds] : undefined }
							: { ...node.config }
				});
				break;
			case "resolveValueState":
				steps.push({
					id: node.id,
					type: "resolveValueState",
					config: {
						resolver:
							node.config.resolver.kind === "fixed"
								? {
										kind: "fixed",
										entries: { ...node.config.resolver.entries },
										fallbackState: node.config.resolver.fallbackState
									}
								: {
										kind: "threshold",
										thresholds: node.config.resolver.thresholds.map((item) =>
											typeof item === "number" ? item : { ...item }
										),
										states: [...node.config.resolver.states],
										invalidState: node.config.resolver.invalidState
									},
						icon: node.config.icon ? { ...node.config.icon } : undefined
					}
				});
				break;
			case "typedValueFormat":
				steps.push({
					id: node.id,
					type: "typedValueFormat",
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
		pushError(state, "config_not_defined", "Конфигурация pipeline не задана.");
		return {
			ok: false,
			errors: state.errors,
			warnings: state.warnings
		};
	}

	if (config.version !== 1) {
		pushError(state, "unsupported_version", `Неподдерживаемая версия pipeline: ${String(config.version)}.`);
		return {
			ok: false,
			errors: state.errors,
			warnings: state.warnings
		};
	}

	if (!config.plan && !config.graph) {
		pushError(state, "graph_or_plan_required", "Для pipeline должен быть задан хотя бы один источник: graph или plan.");
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
			pushWarning(state, "path_broken", "Линейный plan невалиден. Выполнена попытка построить план из graph.");
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

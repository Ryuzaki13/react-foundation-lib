import { VALUE_STATE_RESOLVER_KIND_FIXED, VALUE_STATE_RESOLVER_KIND_THRESHOLD } from "../valueState/valueStateResolverConstants";

import {
	PIPELINE_OVERRIDE_MODE_FORMULA,
	PIPELINE_FORMATTER_TYPED_VALUE_FORMAT,
	PIPELINE_FORMATTER_NORMALIZE_LEADING_ZEROS,
	PIPELINE_FORMATTER_ROW_BASED_OVERRIDE,
	PIPELINE_FORMATTER_RESOLVE_VALUE_STATE,
	PIPELINE_NODE_SOURCE,
	PIPELINE_NODE_SINK,
	PIPELINE_STATE_SOURCE_FORMULA
} from "./formattersPipelineConstants";

import type {
	FormattersPipelineConfig,
	FormattersPipelineGraph,
	FormattersPipelineNode,
	FormattersPipelineNormalizeLeadingZerosConfig,
	FormattersPipelinePlan,
	FormattersPipelineResolveValueStateConfig,
	FormattersPipelineRowBasedOverrideConfig,
	FormattersPipelineStep,
	FormattersPipelineTypedValueFormatConfig
} from "./types";

export function cloneTypedValueFormatConfig(
	config: FormattersPipelineTypedValueFormatConfig | undefined
): FormattersPipelineTypedValueFormatConfig | undefined {
	return config ? { ...config } : undefined;
}

export function cloneNormalizeLeadingZerosConfig(
	config: FormattersPipelineNormalizeLeadingZerosConfig | undefined
): FormattersPipelineNormalizeLeadingZerosConfig | undefined {
	return config ? { ...config } : undefined;
}

export function cloneRowBasedOverrideConfig(config: FormattersPipelineRowBasedOverrideConfig): FormattersPipelineRowBasedOverrideConfig {
	return config.mode === PIPELINE_OVERRIDE_MODE_FORMULA
		? { ...config, dependencyIds: config.dependencyIds ? [...config.dependencyIds] : undefined }
		: { ...config };
}

export function cloneResolveValueStateConfig(config: FormattersPipelineResolveValueStateConfig): FormattersPipelineResolveValueStateConfig {
	return {
		resolver:
			config.resolver.kind === VALUE_STATE_RESOLVER_KIND_FIXED
				? {
						kind: VALUE_STATE_RESOLVER_KIND_FIXED,
						entries: { ...config.resolver.entries },
						fallbackState: config.resolver.fallbackState
					}
				: {
						kind: VALUE_STATE_RESOLVER_KIND_THRESHOLD,
						thresholds: config.resolver.thresholds.map((item) => (typeof item === "number" ? item : { ...item })),
						states: [...config.resolver.states],
						invalidState: config.resolver.invalidState
					},
		valueSource:
			config.valueSource?.kind === PIPELINE_STATE_SOURCE_FORMULA
				? { ...config.valueSource, dependencyIds: [...config.valueSource.dependencyIds] }
				: config.valueSource
					? { ...config.valueSource }
					: undefined,
		icon: config.icon ? { ...config.icon } : undefined
	};
}

export function cloneFormatterPipelinePlanStep(step: FormattersPipelineStep): FormattersPipelineStep {
	switch (step.type) {
		case PIPELINE_FORMATTER_TYPED_VALUE_FORMAT:
			return {
				...step,
				config: cloneTypedValueFormatConfig(step.config)
			};
		case PIPELINE_FORMATTER_NORMALIZE_LEADING_ZEROS:
			return {
				...step,
				config: cloneNormalizeLeadingZerosConfig(step.config)
			};
		case PIPELINE_FORMATTER_ROW_BASED_OVERRIDE:
			return {
				...step,
				config: cloneRowBasedOverrideConfig(step.config)
			};
		case PIPELINE_FORMATTER_RESOLVE_VALUE_STATE:
			return {
				...step,
				config: cloneResolveValueStateConfig(step.config)
			};
		default: {
			const checker: never = step;
			void checker;
		}
	}

	throw new Error(`Недопустимый тип '${(step as Record<string, unknown>)?.type}' для шага FormatterPipeline`);
}

export function cloneFormatterPipelinePlanStepToNode(
	step: FormattersPipelineStep,
	position: { x: number; y: number }
): FormattersPipelineNode {
	switch (step.type) {
		case PIPELINE_FORMATTER_TYPED_VALUE_FORMAT:
			return {
				...step,
				position: { ...position },
				config: cloneTypedValueFormatConfig(step.config)
			};
		case PIPELINE_FORMATTER_NORMALIZE_LEADING_ZEROS:
			return {
				...step,
				position: { ...position },
				config: cloneNormalizeLeadingZerosConfig(step.config)
			};
		case PIPELINE_FORMATTER_ROW_BASED_OVERRIDE:
			return {
				...step,
				position: { ...position },
				config: cloneRowBasedOverrideConfig(step.config)
			};
		case PIPELINE_FORMATTER_RESOLVE_VALUE_STATE:
			return {
				...step,
				position: { ...position },
				config: cloneResolveValueStateConfig(step.config)
			};
		default: {
			const checker: never = step;
			void checker;
		}
	}

	throw new Error(`Недопустимый тип '${(step as Record<string, unknown>)?.type}' для шага FormatterPipeline`);
}

function cloneNode(node: FormattersPipelineNode): FormattersPipelineNode {
	switch (node.type) {
		case PIPELINE_NODE_SOURCE:
		case PIPELINE_NODE_SINK:
			return {
				...node,
				position: { ...node.position }
			};
		default:
			return cloneFormatterPipelinePlanStepToNode(node, node.position);
	}
}

function cloneGraph(graph: FormattersPipelineGraph): FormattersPipelineGraph {
	return {
		nodes: graph.nodes.map(cloneNode),
		edges: graph.edges.map((edge) => ({ ...edge })),
		viewport: graph.viewport ? { ...graph.viewport } : undefined
	};
}

function clonePlan(plan: FormattersPipelinePlan): FormattersPipelinePlan {
	return {
		steps: plan.steps.map(cloneFormatterPipelinePlanStep)
	};
}

/**
 * Возвращает полную копию конфигурации pipeline для безопасного хранения в сторе.
 */
export function cloneFormattersPipelineConfig(config: FormattersPipelineConfig | undefined): FormattersPipelineConfig | undefined {
	if (!config) return undefined;

	const version = config.version;
	const graph = config.graph ? cloneGraph(config.graph) : undefined;
	const plan = config.plan ? clonePlan(config.plan) : undefined;

	return { version, graph, plan };
}

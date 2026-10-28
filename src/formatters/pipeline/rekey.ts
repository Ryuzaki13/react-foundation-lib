import { uuidv4 } from "../../crypto";

import { cloneResolveValueStateConfig } from "./clone";
import {
	PIPELINE_NODE_SOURCE,
	PIPELINE_NODE_SINK,
	PIPELINE_FORMATTER_TYPED_VALUE_FORMAT,
	PIPELINE_FORMATTER_NORMALIZE_LEADING_ZEROS,
	PIPELINE_FORMATTER_ROW_BASED_OVERRIDE,
	PIPELINE_OVERRIDE_MODE_FORMULA,
	PIPELINE_FORMATTER_RESOLVE_VALUE_STATE
} from "./formattersPipelineConstants";
import { validateFormattersPipelineGraph } from "./validate";

import type {
	FormattersPipelineConfig,
	FormattersPipelineEdge,
	FormattersPipelineGraph,
	FormattersPipelineNode,
	FormattersPipelinePlan
} from "./types";

type IdFactory = () => string;

function isSystemNode(node: FormattersPipelineNode): boolean {
	return node.type === PIPELINE_NODE_SOURCE || node.type === PIPELINE_NODE_SINK;
}

function cloneNodeWithId(node: FormattersPipelineNode, id: string): FormattersPipelineNode {
	switch (node.type) {
		case PIPELINE_NODE_SOURCE:
		case PIPELINE_NODE_SINK:
			return {
				...node,
				id,
				position: { ...node.position }
			};
		case PIPELINE_FORMATTER_TYPED_VALUE_FORMAT:
			return {
				...node,
				id,
				position: { ...node.position },
				config: node.config ? { ...node.config } : undefined
			};
		case PIPELINE_FORMATTER_NORMALIZE_LEADING_ZEROS:
			return {
				...node,
				id,
				position: { ...node.position },
				config: node.config ? { ...node.config } : undefined
			};
		case PIPELINE_FORMATTER_ROW_BASED_OVERRIDE:
			return {
				...node,
				id,
				position: { ...node.position },
				config:
					node.config.mode === PIPELINE_OVERRIDE_MODE_FORMULA
						? { ...node.config, dependencyIds: node.config.dependencyIds ? [...node.config.dependencyIds] : undefined }
						: { ...node.config }
			};
		case PIPELINE_FORMATTER_RESOLVE_VALUE_STATE:
			return {
				...node,
				id,
				position: { ...node.position },
				config: cloneResolveValueStateConfig(node.config)
			};
	}
}

function rekeyGraph(graph: FormattersPipelineGraph, idFactory: IdFactory): FormattersPipelineGraph {
	const nodeIdByPreviousId = new Map<string, string>();

	for (const node of graph.nodes) {
		nodeIdByPreviousId.set(node.id, isSystemNode(node) ? node.id : idFactory());
	}

	const edges: FormattersPipelineEdge[] = graph.edges.map((edge) => ({
		id: idFactory(),
		source: nodeIdByPreviousId.get(edge.source) ?? edge.source,
		target: nodeIdByPreviousId.get(edge.target) ?? edge.target
	}));

	return {
		nodes: graph.nodes.map((node) => cloneNodeWithId(node, nodeIdByPreviousId.get(node.id) ?? node.id)),
		edges,
		viewport: graph.viewport ? { ...graph.viewport } : undefined
	};
}

function rekeyPlan(plan: FormattersPipelinePlan, idFactory: IdFactory): FormattersPipelinePlan {
	return {
		steps: plan.steps.map((step) => {
			switch (step.type) {
				case PIPELINE_FORMATTER_TYPED_VALUE_FORMAT:
					return {
						...step,
						id: idFactory(),
						config: step.config ? { ...step.config } : undefined
					};
				case PIPELINE_FORMATTER_NORMALIZE_LEADING_ZEROS:
					return {
						...step,
						id: idFactory(),
						config: step.config ? { ...step.config } : undefined
					};
				case PIPELINE_FORMATTER_ROW_BASED_OVERRIDE:
					return {
						...step,
						id: idFactory(),
						config:
							step.config.mode === PIPELINE_OVERRIDE_MODE_FORMULA
								? { ...step.config, dependencyIds: step.config.dependencyIds ? [...step.config.dependencyIds] : undefined }
								: { ...step.config }
					};
				case PIPELINE_FORMATTER_RESOLVE_VALUE_STATE:
					return {
						...step,
						id: idFactory(),
						config: cloneResolveValueStateConfig(step.config)
					};
			}
		})
	};
}

/**
 * Переиздаёт технические id formatter-нод и step-ов без изменения настроек pipeline.
 *
 * Source/sink сохраняют стабильные id, потому что редактор использует их как
 * служебные якоря графа; все пользовательские formatter id не имеют бизнес-смысла.
 */
export function rekeyFormattersPipelineConfig(
	config: FormattersPipelineConfig | undefined,
	idFactory: IdFactory = uuidv4
): FormattersPipelineConfig | undefined {
	if (!config) return undefined;

	const graph = config.graph ? rekeyGraph(config.graph, idFactory) : undefined;
	const graphValidation = graph ? validateFormattersPipelineGraph(graph) : undefined;

	return {
		version: config.version,
		graph,
		plan:
			graphValidation?.ok && graphValidation.plan ? graphValidation.plan : config.plan ? rekeyPlan(config.plan, idFactory) : undefined
	};
}

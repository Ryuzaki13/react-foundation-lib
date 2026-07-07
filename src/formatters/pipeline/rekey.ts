import { uuidv4 } from "../../crypto";

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
	return node.type === "source" || node.type === "sink";
}

function cloneNodeWithId(node: FormattersPipelineNode, id: string): FormattersPipelineNode {
	switch (node.type) {
		case "source":
		case "sink":
			return {
				...node,
				id,
				position: { ...node.position }
			};
		case "typedValueFormat":
			return {
				...node,
				id,
				position: { ...node.position },
				config: node.config ? { ...node.config } : undefined
			};
		case "normalizeLeadingZeros":
			return {
				...node,
				id,
				position: { ...node.position },
				config: node.config ? { ...node.config } : undefined
			};
		case "rowBasedOverride":
			return {
				...node,
				id,
				position: { ...node.position },
				config:
					node.config.mode === "formula"
						? { ...node.config, dependencyIds: node.config.dependencyIds ? [...node.config.dependencyIds] : undefined }
						: { ...node.config }
			};
		case "resolveValueState":
			return {
				...node,
				id,
				position: { ...node.position },
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
				case "typedValueFormat":
					return {
						...step,
						id: idFactory(),
						config: step.config ? { ...step.config } : undefined
					};
				case "normalizeLeadingZeros":
					return {
						...step,
						id: idFactory(),
						config: step.config ? { ...step.config } : undefined
					};
				case "rowBasedOverride":
					return {
						...step,
						id: idFactory(),
						config:
							step.config.mode === "formula"
								? { ...step.config, dependencyIds: step.config.dependencyIds ? [...step.config.dependencyIds] : undefined }
								: { ...step.config }
					};
				case "resolveValueState":
					return {
						...step,
						id: idFactory(),
						config: {
							resolver:
								step.config.resolver.kind === "fixed"
									? {
											kind: "fixed",
											entries: { ...step.config.resolver.entries },
											fallbackState: step.config.resolver.fallbackState
										}
									: {
											kind: "threshold",
											thresholds: step.config.resolver.thresholds.map((item) =>
												typeof item === "number" ? item : { ...item }
											),
											states: [...step.config.resolver.states],
											invalidState: step.config.resolver.invalidState
										},
							icon: step.config.icon ? { ...step.config.icon } : undefined
						}
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

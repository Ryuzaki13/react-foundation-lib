import { type State } from "../../types";
import { isRecord } from "../../validators/isRecord";

import { cloneFormattersPipelineConfig } from "./clone";
import {
	type FormattersPipelineConfig,
	type FormattersPipelineEdge,
	type FormattersPipelineGraph,
	type FormattersPipelineNode,
	type FormattersPipelinePlan,
	type FormattersPipelineResolveValueStateConfig,
	type FormattersPipelineRowBasedOverrideConfig,
	type FormattersPipelineStep,
	type FormattersPipelineTypedValueFormatConfig
} from "./types";
import { validateFormattersPipelineConfig } from "./validate";

const VALUE_STATES: readonly State[] = ["", "none", "information", "success", "warning", "error"];

function isState(value: unknown): value is State {
	return typeof value === "string" && VALUE_STATES.some((state) => state === value);
}

function isOptionalBoolean(value: unknown): boolean {
	return value === undefined || typeof value === "boolean";
}

function isOptionalString(value: unknown): boolean {
	return value === undefined || typeof value === "string";
}

function isTypedValueFormatConfig(value: unknown): value is FormattersPipelineTypedValueFormatConfig {
	if (value === undefined) return true;
	if (!isRecord(value)) return false;

	return isOptionalString(value.numberPresetName) && isOptionalString(value.datePresetName);
}

function isRowBasedOverrideConfig(value: unknown): value is FormattersPipelineRowBasedOverrideConfig {
	if (!isRecord(value)) return false;

	if (value.mode === "field") {
		return typeof value.fieldKey === "string" && isOptionalBoolean(value.fallbackToRaw);
	}

	if (value.mode === "formula") {
		return (
			typeof value.formulaId === "string" &&
			(value.dependencyIds === undefined ||
				(Array.isArray(value.dependencyIds) && value.dependencyIds.every((dependencyId) => typeof dependencyId === "string"))) &&
			isOptionalBoolean(value.fallbackToRaw)
		);
	}

	return false;
}

function isThresholdDefinition(value: unknown): boolean {
	return (
		typeof value === "number" ||
		(isRecord(value) &&
			typeof value.value === "number" &&
			(value.boundary === undefined || value.boundary === "lower" || value.boundary === "upper"))
	);
}

function isResolveValueStateConfig(value: unknown): value is FormattersPipelineResolveValueStateConfig {
	if (!isRecord(value) || !isRecord(value.resolver)) return false;

	const { resolver, icon } = value;
	const hasValidIcon =
		icon === undefined ||
		(isRecord(icon) &&
			isOptionalBoolean(icon.enabled) &&
			isOptionalBoolean(icon.showValue) &&
			(icon.position === undefined || icon.position === "left" || icon.position === "right"));

	if (!hasValidIcon) return false;

	if (resolver.kind === "fixed") {
		return (
			isRecord(resolver.entries) &&
			Object.values(resolver.entries).every(isState) &&
			(resolver.fallbackState === undefined || isState(resolver.fallbackState))
		);
	}

	if (resolver.kind === "threshold") {
		return (
			Array.isArray(resolver.thresholds) &&
			resolver.thresholds.every(isThresholdDefinition) &&
			Array.isArray(resolver.states) &&
			resolver.states.every(isState) &&
			(resolver.invalidState === undefined || isState(resolver.invalidState))
		);
	}

	return false;
}

function isPipelineStep(value: unknown): value is FormattersPipelineStep {
	if (!isRecord(value) || typeof value.id !== "string") return false;

	if (value.type === "normalizeLeadingZeros") {
		return (
			value.config === undefined ||
			(isRecord(value.config) && (value.config.fixed === undefined || typeof value.config.fixed === "number"))
		);
	}

	if (value.type === "rowBasedOverride") {
		return isRowBasedOverrideConfig(value.config);
	}

	if (value.type === "resolveValueState") {
		return isResolveValueStateConfig(value.config);
	}

	if (value.type === "typedValueFormat") {
		return isTypedValueFormatConfig(value.config);
	}

	return false;
}

function isPipelinePlan(value: unknown): value is FormattersPipelinePlan {
	return isRecord(value) && Array.isArray(value.steps) && value.steps.every(isPipelineStep);
}

function isPipelinePosition(value: unknown): value is { x: number; y: number } {
	return isRecord(value) && typeof value.x === "number" && typeof value.y === "number";
}

function isPipelineNode(value: unknown): value is FormattersPipelineNode {
	if (!isRecord(value) || typeof value.id !== "string" || !isPipelinePosition(value.position)) return false;

	if (value.type === "source" || value.type === "sink") {
		return true;
	}

	return isPipelineStep(value);
}

function isPipelineEdge(value: unknown): value is FormattersPipelineEdge {
	return isRecord(value) && typeof value.id === "string" && typeof value.source === "string" && typeof value.target === "string";
}

function isPipelineGraph(value: unknown): value is FormattersPipelineGraph {
	return (
		isRecord(value) &&
		Array.isArray(value.nodes) &&
		value.nodes.every(isPipelineNode) &&
		Array.isArray(value.edges) &&
		value.edges.every(isPipelineEdge)
	);
}

function isPipelineConfig(value: unknown): value is FormattersPipelineConfig {
	return (
		isRecord(value) &&
		value.version === 1 &&
		(value.plan === undefined || isPipelinePlan(value.plan)) &&
		(value.graph === undefined || isPipelineGraph(value.graph)) &&
		(isPipelinePlan(value.plan) || isPipelineGraph(value.graph))
	);
}

export function normalizeFormattersPipelineConfig(value: unknown): FormattersPipelineConfig | undefined {
	if (!isPipelineConfig(value)) return undefined;

	const validation = validateFormattersPipelineConfig(value);
	if (!validation.ok) return undefined;

	return cloneFormattersPipelineConfig(value);
}

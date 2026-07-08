import { addUnique } from "../../array";

import { validateFormattersPipelineConfig } from "./validate";

import type { FormattersPipelineConfig } from "./types";

/**
 * Минимальный контракт поля, достаточный для сбора runtime-зависимостей.
 *
 * Контракт не привязан к view-config, analytical-table или detail-table:
 * любая зона может передать свой объект, если он содержит эти optional-поля.
 */
export type RuntimeDependencyField = {
	formattersPipeline?: FormattersPipelineConfig;
	cellRenderer?: {
		bindings?: Readonly<Record<string, string | undefined>>;
	};
};

/**
 * План дополнительных полей, которые нужны runtime-логике отображения.
 */
export type RuntimeFieldDependenciesPlan = {
	/** Поля, которые нужно добавить в query для formatter pipeline или renderer bindings. */
	requiredColumnIds: string[];
	/** Зависимости, указанные в настройках, но отсутствующие в справочнике полей. */
	missingColumnIds: string[];
};

/**
 * Собирает только зависимости, объявленные внутри formatter pipeline.
 *
 * Pipeline не проверяет наличие этих полей в конкретной таблице или графике:
 * это ответственность потребителя, который знает свой полный набор полей.
 */
export function collectFormattersPipelineDependencyIds(config: FormattersPipelineConfig | undefined): string[] {
	const validation = validateFormattersPipelineConfig(config);
	if (!validation.ok || !validation.plan) return [];

	const dependencyIds: string[] = [];
	const seen = new Set<string>();

	for (const step of validation.plan.steps) {
		if (step.type !== "rowBasedOverride") continue;

		if (step.config.mode === "field") {
			addUnique(dependencyIds, seen, step.config.fieldKey);
			continue;
		}

		for (const dependencyId of step.config.dependencyIds ?? []) {
			addUnique(dependencyIds, seen, dependencyId);
		}
	}

	return dependencyIds;
}

/**
 * Собирает runtime-зависимости отображения для набора полей.
 *
 * Учитывает:
 * - binding-поля renderer-а;
 * - field/dependency поля formatter-а `rowBasedOverride`.
 */
export function collectRuntimeFieldDependencyIds<TField extends RuntimeDependencyField>(
	fieldIds: readonly string[],
	fieldsById: Readonly<Record<string, TField | undefined>>
): RuntimeFieldDependenciesPlan {
	const requiredColumnIds: string[] = [];
	const missingColumnIds: string[] = [];
	const seenRequired = new Set<string>();
	const seenMissing = new Set<string>();

	const addDependency = (fieldId: string | undefined) => {
		const normalizedId = fieldId?.trim();
		if (!normalizedId) return;

		if (!fieldsById[normalizedId]) {
			addUnique(missingColumnIds, seenMissing, normalizedId);
			return;
		}

		addUnique(requiredColumnIds, seenRequired, normalizedId);
	};

	for (const fieldId of fieldIds) {
		const field = fieldsById[fieldId];
		if (!field) continue;

		for (const bindingFieldId of Object.values(field.cellRenderer?.bindings ?? {})) {
			addDependency(bindingFieldId);
		}

		for (const dependencyId of collectFormattersPipelineDependencyIds(field.formattersPipeline)) {
			addDependency(dependencyId);
		}
	}

	return { requiredColumnIds, missingColumnIds };
}

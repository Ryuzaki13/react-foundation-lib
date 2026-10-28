import { stableStringify } from "../../utils";
import { ANALYTICAL_AGGREGATE_SCOPE_GROUP } from "../definition/analyticalDefinitionConstants";
import { type AnalyticalGroupingLevel, type CompiledAnalyticalTableDefinition } from "../definition/types";

import { ANALYTICAL_ROW_KIND_GROUP } from "./analyticalRowConstants";
import { type AnalyticalHierarchyNode, type AnalyticalSourceHierarchy } from "./hierarchy";
import { calculateAnalyticalTotals } from "./totals";
import { type AnalyticalValues } from "./types";
import { analyticalIdentity } from "./valueComparison";

/** Группировка добавляет уровни над предметными корнями и сохраняет их дочернюю детализацию. */
export function groupAnalyticalHierarchy<T>(args: {
	rows: readonly AnalyticalHierarchyNode<T>[];
	grouping: readonly AnalyticalGroupingLevel[];
	definition: CompiledAnalyticalTableDefinition<T>;
	source: AnalyticalSourceHierarchy<T>;
}): readonly AnalyticalHierarchyNode<T>[] {
	const { grouping, definition, source } = args;
	const groupLevel = (
		rows: readonly AnalyticalHierarchyNode<T>[],
		levelIndex: number,
		path: AnalyticalValues,
		identityPath: readonly string[]
	): readonly AnalyticalHierarchyNode<T>[] => {
		const level = grouping[levelIndex];
		if (!level) return rows;

		const buckets = new Map<string, AnalyticalHierarchyNode<T>[]>();
		for (const row of rows) {
			const key = analyticalIdentity(row.values, level.keyColumnIds);
			const bucket = buckets.get(key);
			if (bucket) bucket.push(row);
			else buckets.set(key, [row]);
		}

		return Array.from(buckets, ([key, members]) => {
			const identity = [...identityPath, level.id, key];
			const id = `analytical-group:${stableStringify(identity)}`;
			if (source.sourceRowIds.has(id)) {
				throw new Error(`Идентификатор исходной строки совпал с группой: ${id}`);
			}

			const groupingPath: Record<string, unknown> = { ...path };
			for (const fieldId of [...level.keyColumnIds, ...(level.displayColumnIds ?? [])]) {
				groupingPath[fieldId] = members[0].values[fieldId];
			}

			return {
				id,
				kind: ANALYTICAL_ROW_KIND_GROUP,
				groupingLevelId: level.id,
				values: calculateAnalyticalTotals({
					definition,
					nodes: members,
					aggregateRowIds: source.aggregateRowIds,
					scope: ANALYTICAL_AGGREGATE_SCOPE_GROUP,
					groupingPath
				}),
				children: groupLevel(members, levelIndex + 1, groupingPath, identity)
			};
		});
	};

	return groupLevel(args.rows, 0, {}, []);
}

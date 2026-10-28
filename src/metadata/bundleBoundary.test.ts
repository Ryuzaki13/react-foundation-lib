import { build, normalizePath, type Rolldown } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
const odataSourceRoot = `${normalizePath(resolve(packageRoot, "src/odata-service"))}/`;
const genericSubpaths = ["formatters", "error-report", "excel", "table", "analytical-table"] as const;

/** Набор экспортируемых значений до разделения модулей: патч сохраняет исходный публичный API. */
const odataRuntimeExports = [
	"BASE_META_TYPES",
	"BASE_META_TYPE_LABELS",
	"FILTER_OPERATIONS",
	"FORCED_CODE_TEXT_IDS",
	"FilterOperation",
	"ODataDateFormat",
	"assertSqlFilterFieldId",
	"buildEntityOperationPath",
	"buildEntityParameters",
	"buildEntityPath",
	"buildFunctionImportParameters",
	"buildFunctionImportPath",
	"buildODataFilter",
	"buildODataFilterRecursive",
	"buildODataOrder",
	"buildODataOrderBy",
	"buildParameterEntries",
	"buildSeparatedArrays",
	"buildSqlFilter",
	"collapseChainedODataSegmentFilterValues",
	"collectFilterableColumns",
	"collectFilterableColumnsIds",
	"compileFiltersToExpression",
	"createBooleanFormatter",
	"createDateFormatter",
	"createFilter",
	"createFilterBetween",
	"createFilterContains",
	"createFilterEqual",
	"createFilterEqualFalsy",
	"createFormatter",
	"createNumberFormatter",
	"createSqlFilterEqual",
	"createSqlFilterGroup",
	"createSqlFilterIn",
	"createStringFormatter",
	"defaultControlTypeValue",
	"defaultODataTypeValue",
	"findCollectionPairs",
	"flattenFilterValuesToODataDependencies",
	"getBaseTypeFromODataType",
	"getFormatter",
	"getFormatterForBaseType",
	"getFormattersFor",
	"getFormattersForBaseType",
	"getSortIndex",
	"getSortIndicator",
	"isBaseMetaType",
	"isBaseValue",
	"isBooleanSafe",
	"isDateSafe",
	"isFilterLocalComponentId",
	"isFilterOperation",
	"isForcedCodeTextFamilyId",
	"isForcedCodeTextId",
	"isNumberSafe",
	"isODataBooleanType",
	"isODataDateType",
	"isODataIntegerType",
	"isODataNumericType",
	"isSqlFilterScalarValue",
	"isStringSafe",
	"mergeFilterExpressions",
	"mergeFilterValuePatch",
	"normalizeBaseValue",
	"normalizeDictionaryCodeKey",
	"normalizeRangeValue",
	"odataCollectionConfig",
	"odataFormatValue",
	"odataParseValue",
	"odataParseValueByMetadata",
	"odataTypeSchemas",
	"parseServiceMetadata",
	"resolveBaseTypeLabel",
	"resolveEffectiveSorts",
	"resolveMetadataColumnLabel",
	"resolveODataFilterDefinitionActiveColumnIds",
	"resolveODataFilterDefinitionColumnIds",
	"resolveOperationLabel",
	"sanitizeFilterBinding",
	"sanitizeFilterConditionGroup",
	"sanitizeFilterDefinitions",
	"sanitizeFilterValue",
	"sanitizeFilterValues",
	"toggleSort",
	"unwrapODataParams",
	"unwrapODataQueryResult",
	"useODataCollectionStore",
	"wrapODataParams"
] as const;

let buildDirectory: string | undefined;
let chunks: readonly Rolldown.OutputChunk[] = [];

function findPublicBundleEntry(subpath: string): Rolldown.OutputChunk {
	const source = normalizePath(resolve(packageRoot, "src", subpath, "index.ts"));
	const entry = chunks.find((chunk) => chunk.facadeModuleId === source);
	if (!entry) throw new Error(`В package build отсутствует entrypoint ${subpath}.`);
	return entry;
}

/** Проверяется весь граф готовой точки входа, включая ленивые зависимости и общие библиотечные чанки. */
function collectReachableRuntimeModules(entry: Rolldown.OutputChunk): ReadonlySet<string> {
	const chunksByName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
	const pending = [entry];
	const visited = new Set<string>();
	const modules = new Set<string>();
	while (pending.length > 0) {
		const chunk = pending.pop();
		if (!chunk || visited.has(chunk.fileName)) continue;
		visited.add(chunk.fileName);
		for (const [id, module] of Object.entries(chunk.modules)) {
			if (module.renderedLength > 0) modules.add(normalizePath(id));
		}
		for (const fileName of [...chunk.imports, ...chunk.dynamicImports]) {
			const dependency = chunksByName.get(fileName);
			if (dependency) pending.push(dependency);
		}
	}
	return modules;
}

beforeAll(async () => {
	buildDirectory = await mkdtemp(resolve(tmpdir(), "foundation-bundle-boundary-"));
	// В validate тесты предшествуют сборке: не полагаемся на старый dist
	// и проверяем ту же конфигурацию всех точек входа, которая формирует npm-артефакт.
	const result = await build({
		root: packageRoot,
		configFile: resolve(packageRoot, "vite.config.ts"),
		logLevel: "silent",
		build: { write: false, outDir: buildDirectory }
	});
	const outputs = Array.isArray(result) ? result : [result];
	chunks = outputs.flatMap((output) => {
		if (!("output" in output)) throw new Error("Для проверки границ ожидалась конечная package build без watcher.");
		return output.output.filter((item) => item.type === "chunk");
	});
}, 30_000);

afterAll(async () => {
	if (buildDirectory) await rm(buildDirectory, { recursive: true, force: true });
});

describe("граница общих модулей и OData в package build", () => {
	it.each(genericSubpaths)("public subpath %s не загружает OData runtime", (subpath) => {
		const entry = findPublicBundleEntry(subpath);
		const odataModules = [...collectReachableRuntimeModules(entry)].filter((id) => id.startsWith(odataSourceRoot));
		expect(odataModules).toEqual([]);
	});

	it("сохраняет исходный runtime API broad entrypoint odata-service", () => {
		expect([...findPublicBundleEntry("odata-service").exports].sort()).toEqual(odataRuntimeExports);
	});
});

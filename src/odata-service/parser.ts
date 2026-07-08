/**
 * Парсер метаданных OData V2
 */

import {
	EntityColumnProperty,
	EntityMetadata,
	EntityParameterProperty,
	FunctionImportMetadata,
	ODataMetaType,
	ServiceMetadata
} from "./types";

const TEXT_SUFFIX_REGEXP = /^(.+)(_txt|_text|_t)$/i;
export const FORCED_CODE_TEXT_IDS: ReadonlySet<string> = new Set(["ZDIV", "ZCFO1"]);

type AssociationSetEndpoint = {
	role: string;
	entitySet: string;
};

type AssociationSetMetadata = {
	ends: AssociationSetEndpoint[];
};

type ResultNavigationMetadata = {
	name: "Set" | "Results";
	targetEntitySet?: string;
};

/** Возвращает label metadata-колонки с fallback на технический id. */
export function resolveMetadataColumnLabel(column: Pick<EntityColumnProperty, "id" | "label">): string {
	return column.label || column.id;
}

export function isForcedCodeTextId(columnId?: string): boolean {
	if (!columnId) return false;
	return FORCED_CODE_TEXT_IDS.has(columnId.toUpperCase());
}

export function isForcedCodeTextFamilyId(columnId?: string): boolean {
	if (!columnId) return false;

	const normalizedId = columnId.toUpperCase();
	if (FORCED_CODE_TEXT_IDS.has(normalizedId)) return true;

	const match = normalizedId.match(/^(.+)(_TXT|_TEXT|_T)$/);
	if (!match) return false;

	return FORCED_CODE_TEXT_IDS.has(match[1]!);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Возвращает `true`, если свойство описано скалярным EDM-типом и может быть
 * представлено в нашей метамодели без отдельной поддержки complex type.
 */
function isScalarEdmPropertyType(typeName: string): boolean {
	return typeName.startsWith("Edm.");
}

function resolveColumnIdByCaseInsensitive(columnsByIdUpper: Record<string, string>, columnId?: string): string | undefined {
	if (!columnId) return undefined;
	return columnsByIdUpper[columnId.toUpperCase()];
}

function findTextColumnForCodeId(
	codeId: string,
	columns: EntityColumnProperty[],
	columnsByIdUpper: Record<string, string>
): string | undefined {
	const normalizedCodeId = resolveColumnIdByCaseInsensitive(columnsByIdUpper, codeId);
	if (!normalizedCodeId) return undefined;

	const textColumnRegExp = new RegExp(`^${escapeRegExp(normalizedCodeId)}(_txt|_text|_t)$`, "i");

	for (const column of columns) {
		if (textColumnRegExp.test(column.id)) {
			return column.id;
		}
	}

	return undefined;
}

function normalizeColumns(columns: EntityColumnProperty[]): EntityColumnProperty[] {
	const columnsById: Record<string, EntityColumnProperty> = {};
	const columnsByIdUpper: Record<string, string> = {};

	for (const column of columns) {
		columnsById[column.id] = column;
		columnsByIdUpper[column.id.toUpperCase()] = column.id;
	}

	for (const column of columns) {
		if (column.role === "measure") {
			column.semanticType = "none";
			column.linkedColumnId = undefined;
			continue;
		}

		column.role = "dimension";
		column.sortable = true;
		column.filterable = true;
		column.semanticType = TEXT_SUFFIX_REGEXP.test(column.id) ? "text" : "code";

		const linkedColumnId = resolveColumnIdByCaseInsensitive(columnsByIdUpper, column.linkedColumnId);
		column.linkedColumnId = linkedColumnId && linkedColumnId !== column.id ? linkedColumnId : undefined;
	}

	for (const column of columns) {
		if (column.role !== "dimension" || column.semanticType !== "code") continue;

		let textColumnId = column.linkedColumnId;
		if (textColumnId) {
			const linkedColumn = columnsById[textColumnId];
			if (!linkedColumn || linkedColumn.role !== "dimension") {
				textColumnId = undefined;
			} else {
				linkedColumn.semanticType = "text";
			}
		}

		if (!textColumnId) {
			textColumnId = findTextColumnForCodeId(column.id, columns, columnsByIdUpper);
		}

		// Часто эти пары не описаны в metadata, поэтому пробуем восстановить их по суффиксу.
		if (!textColumnId && isForcedCodeTextId(column.id)) {
			textColumnId = findTextColumnForCodeId(column.id, columns, columnsByIdUpper);
		}

		column.linkedColumnId = textColumnId;

		if (textColumnId) {
			const textColumn = columnsById[textColumnId];
			if (textColumn && textColumn.role === "dimension") {
				textColumn.semanticType = "text";
				textColumn.linkedColumnId = column.id;
			}
		}
	}

	for (const column of columns) {
		if (column.role !== "dimension" || column.semanticType !== "text") continue;

		let codeColumnId = column.linkedColumnId;
		if (codeColumnId) {
			const linkedColumn = columnsById[codeColumnId];
			if (!linkedColumn || linkedColumn.role !== "dimension") {
				codeColumnId = undefined;
			} else {
				linkedColumn.semanticType = "code";
			}
		}

		if (!codeColumnId) {
			const match = column.id.match(TEXT_SUFFIX_REGEXP);
			const bySuffixCodeId = resolveColumnIdByCaseInsensitive(columnsByIdUpper, match?.[1]);
			if (bySuffixCodeId && columnsById[bySuffixCodeId]?.role === "dimension") {
				codeColumnId = bySuffixCodeId;
			}
		}

		column.linkedColumnId = codeColumnId;

		if (codeColumnId) {
			const codeColumn = columnsById[codeColumnId];
			if (codeColumn && codeColumn.role === "dimension") {
				codeColumn.semanticType = "code";
				if (!codeColumn.linkedColumnId) {
					codeColumn.linkedColumnId = column.id;
				}
			}
		}
	}

	return columns;
}

/**
 * Преобразует EDM-тип во внутренний тип системы.
 */
function mapEdmToServiceType(edm: string): ODataMetaType {
	switch (edm) {
		case "Edm.String":
			return "string";
		case "Edm.Guid":
			return "guid";
		case "Edm.Boolean":
			return "boolean";
		case "Edm.Int16":
		case "Edm.Int32":
			return "int";
		case "Edm.Int64":
			return "long";
		case "Edm.Single":
			return "float";
		case "Edm.Decimal":
			return "decimal";
		case "Edm.Double":
			return "double";
		case "Edm.DateTime":
			return "datetime";
		case "Edm.DateTimeOffset":
			return "datetimeOffset";
		case "Edm.Time":
			return "time";
		case "Edm.Binary":
			return "binary";
		case "Edm.Byte":
			return "byte";
		default:
			throw new Error(`Неподдерживаемый тип данных ${edm}`);
	}
}

/**
 * Создает свойство параметра из XML-элемента.
 */
function createParameterProperty(element: Element): EntityParameterProperty {
	const name = element.getAttribute("Name")!;
	const edmType = element.getAttribute("Type") || "";
	const mapped = mapEdmToServiceType(edmType);

	const maxLength = element.hasAttribute("MaxLength") ? Number(element.getAttribute("MaxLength")) : undefined;
	const precision = element.hasAttribute("Precision") ? Number(element.getAttribute("Precision")) : undefined;
	const scale = element.hasAttribute("Scale") ? Number(element.getAttribute("Scale")) : undefined;
	const label = element.getAttribute("sap:label") || undefined;
	const parameter = element.getAttribute("sap:parameter") || undefined;
	const nullable = element.getAttribute("Nullable") !== "false" ? true : undefined;

	return {
		id: name,
		label: label ?? name,
		type: mapped,
		originalType: edmType,
		...(mapped === "string" && maxLength === 1 ? { abapBooleanLike: true } : {}),
		...(maxLength !== undefined && { maxLength }),
		...(precision !== undefined && { precision }),
		...(scale !== undefined && { scale }),
		...(parameter !== undefined && { parameter }),
		...(nullable !== undefined && { nullable: true }),
		...(parameter === "mandatory" && { mandatory: true })
	};
}

/**
 * Создает свойство колонки из XML-элемента.
 */
function createColumnProperty(element: Element): EntityColumnProperty {
	const baseProps = createParameterProperty(element);

	const linkedColumnId = element.getAttribute("sap:text") || undefined;
	const sortable = element.getAttribute("sap:sortable") !== "false";
	const filterable = element.getAttribute("sap:filterable") !== "false";
	const role = element.getAttribute("sap:aggregation-role") === "measure" ? "measure" : "dimension";
	const label = element.getAttribute("sap:label") || undefined;

	// Убираем свойства, специфичные только для параметров.
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { nullable, mandatory, ...columnProps } = baseProps;

	return {
		...columnProps,
		...(linkedColumnId !== undefined && { linkedColumnId }),
		...(label !== undefined && { label }),
		semanticType: "none",
		sortable,
		filterable,
		role
	};
}

/**
 * Фильтрует свойства, исключая служебные.
 */
function propertyFilter(element: Element): boolean {
	const name = element.getAttribute("Name");
	const typeName = element.getAttribute("Type") || "";

	if (!name) return false;
	if (!isScalarEdmPropertyType(typeName)) return false;

	return !([/*"ID", "Id", "id",*/ "CNT", "cnt"].includes(name) || /_F$/i.test(name));
}

/**
 * Фильтрует свойства для колонок, исключая служебные.
 */
function columnPropertyFilter(element: Element): boolean {
	const name = element.getAttribute("Name");
	const typeName = element.getAttribute("Type") || "";

	if (!name) return false;
	if (!isScalarEdmPropertyType(typeName)) return false;

	return !(["CNT", "cnt"].includes(name) || /_F$/i.test(name));
}

function getProperties(element: Element): Element[] {
	return Array.from(element.getElementsByTagName("Property"));
}

function getKeys(element: Element): Element[] {
	return Array.from(element.getElementsByTagName("PropertyRef"));
}

function getNavigationProperties(element: Element): Element[] {
	return Array.from(element.getElementsByTagName("NavigationProperty"));
}

/**
 * Получает параметры из EntityType.
 */
function getParametersProperties(entity: Element): EntityParameterProperty[] {
	const properties = getProperties(entity).filter(propertyFilter);
	return properties.map(createParameterProperty);
}

/**
 * Получает параметры из EntityType с учетом ключей.
 */
function getParametersPropertiesWithKey(entity: Element): EntityParameterProperty[] {
	const properties = getProperties(entity).filter(propertyFilter);
	const keys = getKeys(entity);

	return properties.map((property) => {
		const param = createParameterProperty(property);
		if (keys.find((key) => key.getAttribute("Name") === param.id)) {
			param.mandatory = true;
		}
		return param;
	});
}

/**
 * Получает колонки из EntityType.
 */
function getColumnsProperties(entity: Element): EntityColumnProperty[] {
	const properties = getProperties(entity).filter(columnPropertyFilter);
	const columns = properties.map(createColumnProperty);
	return normalizeColumns(columns);
}

function extractQualifiedNameShortName(value?: string | null): string | undefined {
	if (!value) return undefined;
	const parts = value.split(".");
	return parts[parts.length - 1] || undefined;
}

function createFunctionImportParameterProperty(element: Element): EntityParameterProperty {
	const mode = element.getAttribute("Mode");
	if (mode && mode !== "In") {
		const name = element.getAttribute("Name") || "(unknown)";
		throw new Error(`FunctionImport parameter '${name}' uses unsupported Mode='${mode}'`);
	}

	const typeName = element.getAttribute("Type") || "";
	if (!isScalarEdmPropertyType(typeName)) {
		const name = element.getAttribute("Name") || "(unknown)";
		throw new Error(`FunctionImport parameter '${name}' uses unsupported Type='${typeName}'`);
	}

	const parameter = createParameterProperty(element);
	if (element.getAttribute("Nullable") === "false") {
		parameter.mandatory = true;
	}

	return parameter;
}

function buildEntityTypeByName(entityNodes: Element[]): Record<string, Element> {
	return entityNodes.reduce<Record<string, Element>>((acc, entity) => {
		const entityName = entity.getAttribute("Name");
		if (entityName) {
			acc[entityName] = entity;
		}
		return acc;
	}, {});
}

function buildEntitySetToEntityTypeMap(xml: Document): Record<string, string> {
	const entitySets = Array.from(xml.getElementsByTagName("EntitySet"));

	return entitySets.reduce<Record<string, string>>((acc, entitySet) => {
		const entitySetName = entitySet.getAttribute("Name");
		const entityType = extractQualifiedNameShortName(entitySet.getAttribute("EntityType"));
		if (!entitySetName || !entityType) return acc;

		acc[entitySetName] = entityType;
		return acc;
	}, {});
}

function buildAssociationSetByName(xml: Document): Record<string, AssociationSetMetadata> {
	const associationSetNodes = Array.from(xml.getElementsByTagName("AssociationSet"));

	return associationSetNodes.reduce<Record<string, AssociationSetMetadata>>((acc, associationSet) => {
		const associationName = associationSet.getAttribute("Association");
		if (!associationName) return acc;

		const ends = Array.from(associationSet.getElementsByTagName("End"))
			.map((end) => {
				const role = end.getAttribute("Role");
				const entitySet = end.getAttribute("EntitySet");
				if (!role || !entitySet) return undefined;
				return { role, entitySet };
			})
			.filter((end): end is AssociationSetEndpoint => Boolean(end));

		const metadata = { ends };
		acc[associationName] = metadata;

		const shortName = extractQualifiedNameShortName(associationName);
		if (shortName) {
			acc[shortName] = metadata;
		}

		return acc;
	}, {});
}

function findResultNavigation(
	entityType: Element,
	associationSetByName: Record<string, AssociationSetMetadata>
): ResultNavigationMetadata | undefined {
	for (const navigationProperty of getNavigationProperties(entityType)) {
		const navigationName = navigationProperty.getAttribute("Name");
		if (navigationName !== "Set" && navigationName !== "Results") {
			continue;
		}

		const relationship = navigationProperty.getAttribute("Relationship");
		const associationSet = relationship ? associationSetByName[relationship] : undefined;
		const toRole = navigationProperty.getAttribute("ToRole");
		const fromRole = navigationProperty.getAttribute("FromRole");

		let targetEntitySet = associationSet?.ends.find((end) => end.role === toRole)?.entitySet;
		if (!targetEntitySet && associationSet) {
			targetEntitySet = associationSet.ends.find((end) => end.role !== fromRole)?.entitySet;
		}

		return {
			name: navigationName,
			targetEntitySet
		};
	}

	return undefined;
}

function buildInternalEntitySetNames(
	entitySetToEntityTypeMap: Record<string, string>,
	entityTypeByName: Record<string, Element>,
	associationSetByName: Record<string, AssociationSetMetadata>
): Set<string> {
	const internalEntitySets = new Set<string>();

	for (const [entitySetName, entityTypeName] of Object.entries(entitySetToEntityTypeMap)) {
		const entityType = entityTypeByName[entityTypeName];
		if (!entityType) continue;

		const resultNavigation = findResultNavigation(entityType, associationSetByName);
		if (!resultNavigation?.targetEntitySet) continue;
		if (resultNavigation.targetEntitySet === entitySetName) continue;

		internalEntitySets.add(resultNavigation.targetEntitySet);
	}

	return internalEntitySets;
}

function resolveColumnsEntityType(
	entityType: Element,
	resultNavigation: ResultNavigationMetadata | undefined,
	entitySetToEntityTypeMap: Record<string, string>,
	entityTypeByName: Record<string, Element>
): Element {
	const resultEntityTypeName = resultNavigation?.targetEntitySet ? entitySetToEntityTypeMap[resultNavigation.targetEntitySet] : undefined;
	return (resultEntityTypeName && entityTypeByName[resultEntityTypeName]) || entityType;
}

function resolveEntityParameters(entityType: Element, entityTypeName: string, resultNavigation: ResultNavigationMetadata | undefined) {
	if (resultNavigation) {
		return getParametersProperties(entityType);
	}

	if (entityTypeName.endsWith("Type")) {
		return undefined;
	}

	return getParametersPropertiesWithKey(entityType);
}

function getActionForKeyIds(actionFor: string | undefined, entityTypeByName: Record<string, Element>): Set<string> {
	if (!actionFor) return new Set<string>();

	const entityTypeName = extractQualifiedNameShortName(actionFor);
	if (!entityTypeName) return new Set<string>();

	const entityType = entityTypeByName[entityTypeName];
	if (!entityType) return new Set<string>();

	return new Set(
		getKeys(entityType)
			.map((key) => key.getAttribute("Name"))
			.filter((value): value is string => Boolean(value))
	);
}

function parseFunctionImport(
	element: Element,
	entitySetToEntityTypeMap: Record<string, string>,
	entityTypeByName: Record<string, Element>
): FunctionImportMetadata {
	const name = element.getAttribute("Name") || "";
	const entitySet = element.getAttribute("EntitySet") || undefined;
	const actionFor = element.getAttribute("sap:action-for") || undefined;
	const actionForKeyIds = getActionForKeyIds(actionFor, entityTypeByName);
	const parameters = Array.from(element.getElementsByTagName("Parameter")).map((parameterElement) => {
		const parameter = createFunctionImportParameterProperty(parameterElement);
		if (actionForKeyIds.has(parameter.id)) {
			parameter.mandatory = true;
		}
		return parameter;
	});

	return {
		name,
		title: element.getAttribute("sap:label") || "",
		httpMethod: (element.getAttribute("m:HttpMethod") as FunctionImportMetadata["httpMethod"] | null) || undefined,
		parameters: parameters.length ? parameters : undefined,
		returnType: element.getAttribute("ReturnType") || "",
		...(entitySet !== undefined && { entitySet }),
		...(actionFor !== undefined && { actionFor }),
		...(entitySet && entitySetToEntityTypeMap[entitySet] ? { resultEntity: entitySet } : {})
	};
}

/**
 * Парсит метаданные OData V2 из XML.
 */
export function parseServiceMetadata(xmlText: string): ServiceMetadata {
	const parser = new DOMParser();
	const xml = parser.parseFromString(xmlText, "application/xml");
	const entityNodes = Array.from(xml.getElementsByTagName("EntityType"));
	const functionImportNodes = Array.from(xml.getElementsByTagName("FunctionImport"));
	const entitySetToEntityTypeMap = buildEntitySetToEntityTypeMap(xml);
	const entityTypeByName = buildEntityTypeByName(entityNodes);
	const associationSetByName = buildAssociationSetByName(xml);
	const internalEntitySets = buildInternalEntitySetNames(entitySetToEntityTypeMap, entityTypeByName, associationSetByName);

	const entities: Record<string, EntityMetadata> = {};
	const functionImports: Record<string, FunctionImportMetadata> = {};

	for (const [entitySetName, entityTypeName] of Object.entries(entitySetToEntityTypeMap)) {
		if (internalEntitySets.has(entitySetName)) {
			continue;
		}

		const entityType = entityTypeByName[entityTypeName];
		if (!entityType) {
			continue;
		}

		const resultNavigation = findResultNavigation(entityType, associationSetByName);
		const columnsEntityType = resolveColumnsEntityType(entityType, resultNavigation, entitySetToEntityTypeMap, entityTypeByName);
		const title = entityType.getAttribute("sap:label") || columnsEntityType.getAttribute("sap:label") || "";
		const columns = getColumnsProperties(columnsEntityType);
		const parameters = resolveEntityParameters(entityType, entityTypeName, resultNavigation);

		entities[entitySetName] = {
			title,
			columns,
			...(parameters?.length ? { parameters } : {}),
			...(resultNavigation ? { result: resultNavigation.name } : {})
		};
	}

	for (const functionImport of functionImportNodes) {
		const parsed = parseFunctionImport(functionImport, entitySetToEntityTypeMap, entityTypeByName);
		functionImports[parsed.name] = parsed;
	}

	return { entities, functionImports };
}

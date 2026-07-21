/**
 * Построитель URL для OData сущностей на основе метаданных
 */

import { odataFormatValue } from "./formatters";
import {
	type EntityMetadata,
	type EntityParameterProperty,
	type FunctionImportMetadata,
	type ODataOperationMethod,
	type ODataParameterValue,
	type ODataServiceConfig,
	type ODataValue,
	type WrappedODataParameters
} from "./types";

type ParameterizedMetadata = {
	parameters?: EntityParameterProperty[];
};

/**
 * Валидирует длину отформатированного значения
 * @param formattedValue Отформатированное значение
 * @param maxLength Максимальная длина
 */
function validateFormattedLength(formattedValue: string, maxLength?: number): void {
	if (!maxLength || typeof maxLength !== "number") return;

	// Проверяем что значение в кавычках и содержимое не превышает maxLength
	const match = formattedValue.match(/^'(.*)'$/s);
	if (!match) {
		throw new Error(`Значение должно быть заключено в одинарные кавычки: ${formattedValue}`);
	}

	const content = match[1];
	if (content.length > maxLength) {
		throw new Error(
			`Значение слишком длинное для maxLength=${maxLength}: '${formattedValue}' (${content.length} символов внутри кавычек)`
		);
	}
}

/**
 * Собирает строку параметров запроса к сущности на основе метаданных
 *
 * @param metadata Метаданные сущности
 * @param params Значения параметров
 */
export function buildParameterEntries(metadata: ParameterizedMetadata, params: WrappedODataParameters): Array<[string, string]> {
	if (!metadata.parameters) return [];

	const parts = metadata.parameters.map<[string, string] | null>((param) => {
		const { id, type, maxLength, mandatory } = param;

		const odataValue = (params[id] ?? {}) as ODataValue<ODataParameterValue>;
		const value = odataValue.value;
		const formatter = odataValue.formatter;

		if (mandatory && (value === undefined || value === null)) {
			throw new Error(`Отсутствует обязательный параметр: ${id}`);
		}

		// Пропускаем необязательные параметры без значений
		if (value === undefined || value === null) return null;

		try {
			if (Array.isArray(value) && !formatter) {
				throw new Error("Массив значений OData-параметра требует custom formatter");
			}

			const formattedValue = formatter ? formatter(value) : odataFormatValue(type, value);

			validateFormattedLength(formattedValue, maxLength);

			return [id, formattedValue];
		} catch (error) {
			throw new Error(`Ошибка форматирования параметра ${id}: ${String(error)}`);
		}
	});

	return parts.filter((part): part is [string, string] => part !== null);
}

/**
 * Собирает строку параметров запроса к сущности на основе metadata.
 */
export function buildEntityParameters(metadata: EntityMetadata, params: WrappedODataParameters): string {
	const parts = buildParameterEntries(metadata, params);
	return parts.length ? `(${parts.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join(",")})` : "";
}

/**
 * Собирает query string-параметры для FunctionImport.
 */
export function buildFunctionImportParameters(metadata: FunctionImportMetadata, params: WrappedODataParameters): URLSearchParams {
	const searchParams = new URLSearchParams();

	for (const [key, value] of buildParameterEntries(metadata, params)) {
		searchParams.set(key, value);
	}

	return searchParams;
}

export function buildEntityOperationPath(
	metadata: EntityMetadata,
	config: ODataServiceConfig,
	params: WrappedODataParameters,
	method: Exclude<ODataOperationMethod, "fi">
): string {
	const basePath = `/${config.service}/${config.target}`;

	if (method === "create") {
		return basePath;
	}

	if (method === "query") {
		if (!metadata.result) {
			if (__DEV__) {
				if (Object.keys(params).length > 0) {
					console.warn(
						`Параметры для query-запроса '/${config.service}/${config.target}' проигнорированы: target не поддерживает parameterized query.`
					);
				}
			}

			return basePath;
		}

		return buildEntityPath(metadata, config, params);
	}

	const parameters = buildEntityParameters(metadata, params);
	return `${basePath}${parameters}`;
}

/**
 * Собирает строку запроса к FunctionImport.
 */
export function buildFunctionImportPath(
	metadata: FunctionImportMetadata,
	config: ODataServiceConfig,
	params: WrappedODataParameters
): string {
	const searchParams = buildFunctionImportParameters(metadata, params);
	const queryString = searchParams.toString();
	const path = `/${config.service}/${config.target}`;

	return queryString ? `${path}?${queryString}` : path;
}

/**
 * Собирает строку запроса к EntitySet
 */
export function buildEntityPath(metadata: EntityMetadata, config: ODataServiceConfig, params: WrappedODataParameters): string {
	const parameters = buildEntityParameters(metadata, params);
	const navigation = metadata.result ? `/${metadata.result}` : "";

	return `/${config.service}/${config.target}${parameters}${navigation}`;
}

import { describe, expect, it, vi } from "vitest";

import {
	buildEntityOperationPath,
	buildEntityParameters,
	buildEntityPath,
	buildFunctionImportParameters,
	buildFunctionImportPath,
	buildParameterEntries
} from "./builder";

import type { EntityMetadata, FunctionImportMetadata, ODataServiceConfig } from "./types";

const config: ODataServiceConfig = {
	service: "TEXT_DEMO_SRV",
	target: "TextEntitySet"
};

const entityMetadata: EntityMetadata = {
	title: "Demo",
	result: "Results",
	columns: [],
	parameters: [
		{
			id: "p_code",
			label: "Код",
			type: "string",
			originalType: "Edm.String",
			mandatory: true,
			maxLength: 4
		},
		{
			id: "p_flag",
			label: "Флаг",
			type: "boolean",
			originalType: "Edm.Boolean"
		}
	]
};

const functionImportMetadata: FunctionImportMetadata = {
	name: "RunDemo",
	title: "Запуск",
	returnType: "TextEntitySet",
	parameters: entityMetadata.parameters
};

describe("odata-service builder", () => {
	it("строит parameter entries по metadata и пропускает пустые optional params", () => {
		expect(buildParameterEntries(entityMetadata, { p_code: { value: "AB" }, p_flag: { value: null } })).toEqual([["p_code", "'AB'"]]);
	});

	it("поддерживает custom formatter параметра", () => {
		expect(
			buildParameterEntries(entityMetadata, {
				p_code: { value: "AB", formatter: (value) => `'${String(value).toLowerCase()}'` }
			})
		).toEqual([["p_code", "'ab'"]]);
	});

	it("валидирует mandatory и maxLength параметров", () => {
		expect(() => buildParameterEntries(entityMetadata, {})).toThrow("Отсутствует обязательный параметр: p_code");
		expect(() => buildParameterEntries(entityMetadata, { p_code: { value: "ABCDE" } })).toThrow("maxLength=4");
	});

	it("собирает entity path и operation path", () => {
		const params = { p_code: { value: "AB" }, p_flag: { value: true } };

		expect(buildEntityParameters(entityMetadata, params)).toBe("(p_code='AB',p_flag='X')");
		expect(buildEntityPath(entityMetadata, config, params)).toBe("/TEXT_DEMO_SRV/TextEntitySet(p_code='AB',p_flag='X')/Results");
		expect(buildEntityOperationPath(entityMetadata, config, params, "query")).toBe(
			"/TEXT_DEMO_SRV/TextEntitySet(p_code='AB',p_flag='X')/Results"
		);
		expect(buildEntityOperationPath(entityMetadata, config, params, "create")).toBe("/TEXT_DEMO_SRV/TextEntitySet");
		expect(buildEntityOperationPath(entityMetadata, config, params, "update")).toBe("/TEXT_DEMO_SRV/TextEntitySet(p_code='AB',p_flag='X')");
	});

	it("игнорирует query params для непараметризованного EntitySet и предупреждает в dev", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const metadata: EntityMetadata = { title: "Plain", columns: [] };

		expect(buildEntityOperationPath(metadata, config, { p_code: { value: "AB" } }, "query")).toBe("/TEXT_DEMO_SRV/TextEntitySet");
		expect(warn).toHaveBeenCalledOnce();

		warn.mockRestore();
	});

	it("собирает FunctionImport query params без encodeURIComponent в values API", () => {
		const searchParams = buildFunctionImportParameters(functionImportMetadata, {
			p_code: { value: "AB" },
			p_flag: { value: false }
		});

		expect(searchParams.get("p_code")).toBe("'AB'");
		expect(searchParams.get("p_flag")).toBe("' '");
		expect(buildFunctionImportPath(functionImportMetadata, config, { p_code: { value: "AB" } })).toBe(
			"/TEXT_DEMO_SRV/TextEntitySet?p_code=%27AB%27"
		);
	});

	it("возвращает base path для FunctionImport без параметров", () => {
		expect(buildFunctionImportPath({ ...functionImportMetadata, parameters: undefined }, config, {})).toBe("/TEXT_DEMO_SRV/TextEntitySet");
	});
});

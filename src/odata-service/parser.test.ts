// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { buildEntityOperationPath, buildEntityPath, buildFunctionImportPath } from "./builder";
import { isForcedCodeTextFamilyId, isForcedCodeTextId, parseServiceMetadata, resolveMetadataColumnLabel } from "./parser";

const zarmMetadataXml = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx">
	<edmx:DataServices xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" m:DataServiceVersion="2.0">
		<Schema Namespace="ZARM_APP_SRV" xmlns="http://schemas.microsoft.com/ado/2008/09/edm" xmlns:sap="http://www.sap.com/Protocols/SAPData">
			<EntityType Name="VARIANT" sap:label="Варианты">
				<Key>
					<PropertyRef Name="variantId" />
				</Key>
				<Property Name="variantId" Type="Edm.String" Nullable="false" />
				<Property Name="appId" Type="Edm.String" />
				<Property Name="viewId" Type="Edm.String" />
				<Property Name="variantName" Type="Edm.String" MaxLength="60" sap:label="Имя варианта" />
				<Property Name="isPublic" Type="Edm.String" MaxLength="1" />
			</EntityType>
			<EntityContainer Name="ZARM_APP_SRV_Entities" m:IsDefaultEntityContainer="true">
				<EntitySet Name="VARIANT" EntityType="ZARM_APP_SRV.VARIANT" />
				<FunctionImport
					Name="setVariantDefault"
					ReturnType="ZARM_APP_SRV.VARIANT"
					EntitySet="VARIANT"
					m:HttpMethod="POST"
					sap:action-for="ZARM_APP_SRV.VARIANT">
					<Parameter Name="variantId" Type="Edm.String" Mode="In" />
					<Parameter Name="appId" Type="Edm.String" Mode="In" />
					<Parameter Name="viewId" Type="Edm.String" Mode="In" />
				</FunctionImport>
			</EntityContainer>
		</Schema>
	</edmx:DataServices>
</edmx:Edmx>`;

const salesMetadataXml = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx">
	<edmx:DataServices xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" m:DataServiceVersion="2.0">
		<Schema Namespace="SALES_SRV" xmlns="http://schemas.microsoft.com/ado/2008/09/edm" xmlns:sap="http://www.sap.com/Protocols/SAPData">
			<EntityType Name="ZP_ZDSALES_MANAGER">
				<Key>
					<PropertyRef Name="p_date" />
					<PropertyRef Name="p_date_to" />
					<PropertyRef Name="type_manager" />
				</Key>
				<Property Name="p_date" Type="Edm.DateTime" Nullable="false" sap:parameter="mandatory" />
				<Property Name="p_date_to" Type="Edm.DateTime" Nullable="false" sap:parameter="mandatory" />
				<Property Name="type_manager" Type="Edm.String" Nullable="false" sap:parameter="mandatory" />
				<NavigationProperty Name="Results" Relationship="SALES_SRV.ManagerResultsAssoc" FromRole="Parameters" ToRole="Results" />
			</EntityType>
			<EntityType Name="ZP_ZDSALES_MANAGERResults">
				<Key>
					<PropertyRef Name="ID" />
				</Key>
				<Property Name="ID" Type="Edm.String" Nullable="false" />
				<Property Name="MANAGER" Type="Edm.String" sap:aggregation-role="dimension" />
				<Property Name="NETWR" Type="Edm.Decimal" sap:aggregation-role="measure" />
			</EntityType>
			<Association Name="ManagerResultsAssoc">
				<End Type="SALES_SRV.ZP_ZDSALES_MANAGER" Role="Parameters" Multiplicity="1" />
				<End Type="SALES_SRV.ZP_ZDSALES_MANAGERResults" Role="Results" Multiplicity="*" />
			</Association>
			<EntityContainer Name="SALES_SRV_Entities" m:IsDefaultEntityContainer="true">
				<EntitySet Name="ZP_ZDSALES_MANAGER" EntityType="SALES_SRV.ZP_ZDSALES_MANAGER" />
				<EntitySet Name="ZP_ZDSALES_MANAGERResults" EntityType="SALES_SRV.ZP_ZDSALES_MANAGERResults" />
				<AssociationSet Name="ManagerResultsAssocSet" Association="SALES_SRV.ManagerResultsAssoc">
					<End Role="Parameters" EntitySet="ZP_ZDSALES_MANAGER" />
					<End Role="Results" EntitySet="ZP_ZDSALES_MANAGERResults" />
				</AssociationSet>
			</EntityContainer>
		</Schema>
	</edmx:DataServices>
</edmx:Edmx>`;

const typeCoverageMetadataXml = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx">
	<edmx:DataServices xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" m:DataServiceVersion="2.0">
		<Schema Namespace="TYPE_SRV" xmlns="http://schemas.microsoft.com/ado/2008/09/edm" xmlns:sap="http://www.sap.com/Protocols/SAPData">
			<EntityType Name="PRODUCT" sap:label="Товары">
				<Key>
					<PropertyRef Name="ID" />
				</Key>
				<Property Name="ID" Type="Edm.String" Nullable="false" sap:label="Код" />
				<Property Name="GUID_VALUE" Type="Edm.Guid" />
				<Property Name="FLAG" Type="Edm.Boolean" />
				<Property Name="BYTE_VALUE" Type="Edm.Byte" />
				<Property Name="INT_VALUE" Type="Edm.Int16" />
				<Property Name="INT32_VALUE" Type="Edm.Int32" />
				<Property Name="LONG_VALUE" Type="Edm.Int64" />
				<Property Name="FLOAT_VALUE" Type="Edm.Single" />
				<Property Name="DECIMAL_VALUE" Type="Edm.Decimal" Precision="13" Scale="2" sap:aggregation-role="measure" sap:sortable="false" sap:filterable="false" />
				<Property Name="DOUBLE_VALUE" Type="Edm.Double" />
				<Property Name="DATE_VALUE" Type="Edm.DateTime" />
				<Property Name="DATETIME_OFFSET_VALUE" Type="Edm.DateTimeOffset" />
				<Property Name="TIME_VALUE" Type="Edm.Time" />
				<Property Name="BINARY_VALUE" Type="Edm.Binary" />
				<Property Name="ZDIV" Type="Edm.String" sap:text="zdiv_text" />
				<Property Name="zdiv_text" Type="Edm.String" />
				<Property Name="ZCFO1" Type="Edm.String" />
				<Property Name="ZCFO1_T" Type="Edm.String" />
				<Property Name="CNT" Type="Edm.Int32" />
				<Property Name="HIDDEN_F" Type="Edm.String" />
				<Property Name="COMPLEX" Type="TYPE_SRV.Address" />
			</EntityType>
			<EntityType Name="REPORTType" sap:label="Отчёт">
				<Key>
					<PropertyRef Name="P_DATE" />
				</Key>
				<Property Name="P_DATE" Type="Edm.DateTime" Nullable="false" sap:parameter="mandatory" />
				<Property Name="VALUE" Type="Edm.Decimal" sap:aggregation-role="measure" />
			</EntityType>
			<EntityContainer Name="TYPE_SRV_Entities" m:IsDefaultEntityContainer="true">
				<EntitySet Name="PRODUCT" EntityType="TYPE_SRV.PRODUCT" />
				<EntitySet Name="REPORT" EntityType="TYPE_SRV.REPORTType" />
				<FunctionImport Name="ping" ReturnType="Edm.String" m:HttpMethod="GET" />
				<FunctionImport Name="exportProduct" EntitySet="MISSING" ReturnType="TYPE_SRV.PRODUCT">
					<Parameter Name="ID" Type="Edm.String" Nullable="false" MaxLength="10" />
				</FunctionImport>
			</EntityContainer>
		</Schema>
	</edmx:DataServices>
</edmx:Edmx>`;

const unsupportedMetadataXml = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx">
	<edmx:DataServices xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" m:DataServiceVersion="2.0">
		<Schema Namespace="BAD_SRV" xmlns="http://schemas.microsoft.com/ado/2008/09/edm">
			<EntityType Name="BAD">
				<Property Name="VALUE" Type="Edm.Geography" />
			</EntityType>
			<EntityContainer Name="BAD_SRV_Entities">
				<EntitySet Name="BAD" EntityType="BAD_SRV.BAD" />
				<FunctionImport Name="badMode">
					<Parameter Name="VALUE" Type="Edm.String" Mode="Out" />
				</FunctionImport>
			</EntityContainer>
		</Schema>
	</edmx:DataServices>
</edmx:Edmx>`;

const unsupportedFunctionImportTypeXml = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx">
	<edmx:DataServices xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" m:DataServiceVersion="2.0">
		<Schema Namespace="BAD_SRV" xmlns="http://schemas.microsoft.com/ado/2008/09/edm">
			<EntityContainer Name="BAD_SRV_Entities">
				<FunctionImport Name="badType">
					<Parameter Name="VALUE" Type="BAD_SRV.Complex" Mode="In" />
				</FunctionImport>
			</EntityContainer>
		</Schema>
	</edmx:DataServices>
</edmx:Edmx>`;

const unsupportedFunctionImportModeXml = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx">
	<edmx:DataServices xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" m:DataServiceVersion="2.0">
		<Schema Namespace="BAD_SRV" xmlns="http://schemas.microsoft.com/ado/2008/09/edm">
			<EntityContainer Name="BAD_SRV_Entities">
				<FunctionImport Name="badMode">
					<Parameter Name="VALUE" Type="Edm.String" Mode="Out" />
				</FunctionImport>
			</EntityContainer>
		</Schema>
	</edmx:DataServices>
</edmx:Edmx>`;

describe("odata metadata parser / canonical target", () => {
	it("возвращает label колонки и forced code/text family flags", () => {
		expect(resolveMetadataColumnLabel({ id: "ID", label: "Код" })).toBe("Код");
		expect(resolveMetadataColumnLabel({ id: "ID", label: "" })).toBe("ID");
		expect(isForcedCodeTextId("zdiv")).toBe(true);
		expect(isForcedCodeTextFamilyId("zcfo1_text")).toBe(true);
		expect(isForcedCodeTextFamilyId("unknown_text")).toBe(false);
		expect(isForcedCodeTextId(undefined)).toBe(false);
	});

	it("парсит entity и FunctionImport по каноническим именам из metadata", () => {
		const metadata = parseServiceMetadata(zarmMetadataXml);
		const functionImport = metadata.functionImports.setVariantDefault;

		expect(Object.keys(metadata.entities)).toContain("VARIANT");
		expect(metadata.entities).not.toHaveProperty("ZUI_VARIANT");
		expect(functionImport).toMatchObject({
			name: "setVariantDefault",
			httpMethod: "POST",
			entitySet: "VARIANT",
			actionFor: "ZARM_APP_SRV.VARIANT",
			returnType: "ZARM_APP_SRV.VARIANT",
			resultEntity: "VARIANT"
		});

		expect(functionImport.parameters?.map((parameter) => parameter.id)).toEqual(["variantId", "appId", "viewId"]);
		expect(functionImport.parameters?.find((parameter) => parameter.id === "variantId")?.mandatory).toBe(true);
		expect(functionImport.parameters?.find((parameter) => parameter.id === "appId")?.mandatory).toBeUndefined();
	});

	it("сохраняет derived-признак abapBooleanLike для string(1)", () => {
		const metadata = parseServiceMetadata(zarmMetadataXml);
		const isPublicColumn = metadata.entities.VARIANT.columns.find((column) => column.id === "isPublic");
		const variantNameColumn = metadata.entities.VARIANT.columns.find((column) => column.id === "variantName");

		expect(isPublicColumn?.abapBooleanLike).toBe(true);
		expect(variantNameColumn?.abapBooleanLike).toBeUndefined();
	});

	it("строит entity path из канонического target без автодобавления Set", () => {
		const metadata = parseServiceMetadata(zarmMetadataXml);
		const entity = metadata.entities.VARIANT;

		expect(buildEntityPath(entity, { service: "ZARM_APP_SRV", target: "VARIANT" }, { variantId: { value: "uuid-1" } })).toBe(
			"/ZARM_APP_SRV/VARIANT(variantId='uuid-1')"
		);
	});

	it("строит operation path для create без параметров", () => {
		const metadata = parseServiceMetadata(zarmMetadataXml);
		const entity = metadata.entities.VARIANT;

		expect(buildEntityOperationPath(entity, { service: "ZARM_APP_SRV", target: "VARIANT" }, {}, "create")).toBe(
			"/ZARM_APP_SRV/VARIANT"
		);
	});

	it("строит query string path для FunctionImport через target", () => {
		const metadata = parseServiceMetadata(zarmMetadataXml);
		const functionImport = metadata.functionImports.setVariantDefault;

		expect(
			buildFunctionImportPath(
				functionImport,
				{ service: "ZARM_APP_SRV", target: "setVariantDefault" },
				{
					variantId: { value: "uuid-1" },
					appId: { value: "app" },
					viewId: { value: "main" }
				}
			)
		).toBe("/ZARM_APP_SRV/setVariantDefault?variantId=%27uuid-1%27&appId=%27app%27&viewId=%27main%27");
	});

	it("требует обязательные параметры FunctionImport", () => {
		const metadata = parseServiceMetadata(zarmMetadataXml);
		const functionImport = metadata.functionImports.setVariantDefault;

		expect(() =>
			buildFunctionImportPath(
				functionImport,
				{ service: "ZARM_APP_SRV", target: "setVariantDefault" },
				{
					appId: { value: "app" },
					viewId: { value: "main" }
				}
			)
		).toThrow("Отсутствует обязательный параметр: variantId");
	});

	it("публикует параметризованный CDS target, но не публикует связанный Results-target отдельно", () => {
		const metadata = parseServiceMetadata(salesMetadataXml);
		const entity = metadata.entities.ZP_ZDSALES_MANAGER;

		expect(metadata.entities).toHaveProperty("ZP_ZDSALES_MANAGER");
		expect(metadata.entities).not.toHaveProperty("ZP_ZDSALES_MANAGERResults");
		expect(entity?.result).toBe("Results");
		expect(entity?.parameters?.map((parameter) => parameter.id)).toEqual(["p_date", "p_date_to", "type_manager"]);
		expect(entity?.columns.length).toBeGreaterThan(0);
	});

	it("строит operation path для query parameterized entity с suffix результата", () => {
		const metadata = parseServiceMetadata(salesMetadataXml);
		const entity = metadata.entities.ZP_ZDSALES_MANAGER;

		expect(
			buildEntityOperationPath(
				entity,
				{ service: "SALES_SRV", target: "ZP_ZDSALES_MANAGER" },
				{
					p_date: { value: new Date("2024-01-01T00:00:00.000Z") },
					p_date_to: { value: new Date("2024-01-31T00:00:00.000Z") },
					type_manager: { value: "MAIN" }
				},
				"query"
			)
		).toContain("/SALES_SRV/ZP_ZDSALES_MANAGER(");
		expect(
			buildEntityOperationPath(
				entity,
				{ service: "SALES_SRV", target: "ZP_ZDSALES_MANAGER" },
				{
					p_date: { value: new Date("2024-01-01T00:00:00.000Z") },
					p_date_to: { value: new Date("2024-01-31T00:00:00.000Z") },
					type_manager: { value: "MAIN" }
				},
				"query"
			)
		).toContain("/Results");
	});

	it("мапит EDM-типы, исключает служебные поля и восстанавливает code/text связи", () => {
		const metadata = parseServiceMetadata(typeCoverageMetadataXml);
		const product = metadata.entities.PRODUCT;
		const columnsById = Object.fromEntries(product.columns.map((column) => [column.id, column]));

		expect(product.title).toBe("Товары");
		expect(product.parameters?.find((parameter) => parameter.id === "ID")?.mandatory).toBe(true);
		expect(columnsById.ID).toMatchObject({ label: "Код", type: "string", role: "dimension", semanticType: "code" });
		expect(columnsById.GUID_VALUE?.type).toBe("guid");
		expect(columnsById.FLAG?.type).toBe("boolean");
		expect(columnsById.BYTE_VALUE?.type).toBe("byte");
		expect(columnsById.INT_VALUE?.type).toBe("int");
		expect(columnsById.INT32_VALUE?.type).toBe("int");
		expect(columnsById.LONG_VALUE?.type).toBe("long");
		expect(columnsById.FLOAT_VALUE?.type).toBe("float");
		expect(columnsById.DOUBLE_VALUE?.type).toBe("double");
		expect(columnsById.DATE_VALUE?.type).toBe("datetime");
		expect(columnsById.DATETIME_OFFSET_VALUE?.type).toBe("datetimeOffset");
		expect(columnsById.TIME_VALUE?.type).toBe("time");
		expect(columnsById.BINARY_VALUE?.type).toBe("binary");
		expect(columnsById.DECIMAL_VALUE).toMatchObject({
			type: "decimal",
			precision: 13,
			scale: 2,
			role: "measure",
			semanticType: "none",
			sortable: false,
			filterable: false
		});
		expect(columnsById.ZDIV).toMatchObject({ semanticType: "code", linkedColumnId: "zdiv_text" });
		expect(columnsById.zdiv_text).toMatchObject({ semanticType: "text", linkedColumnId: "ZDIV" });
		expect(columnsById.ZCFO1).toMatchObject({ semanticType: "code", linkedColumnId: "ZCFO1_T" });
		expect(columnsById.ZCFO1_T).toMatchObject({ semanticType: "text", linkedColumnId: "ZCFO1" });
		expect(product.columns.map((column) => column.id)).not.toEqual(expect.arrayContaining(["CNT", "HIDDEN_F", "COMPLEX"]));
	});

	it("не создаёт parameters для EntityType с суффиксом Type без result navigation", () => {
		const metadata = parseServiceMetadata(typeCoverageMetadataXml);

		expect(metadata.entities.REPORT.parameters).toBeUndefined();
		expect(metadata.entities.REPORT.columns.map((column) => column.id)).toEqual(["P_DATE", "VALUE"]);
	});

	it("парсит FunctionImport без параметров и mandatory по Nullable=false", () => {
		const metadata = parseServiceMetadata(typeCoverageMetadataXml);

		expect(metadata.functionImports.ping).toEqual({
			name: "ping",
			title: "",
			httpMethod: "GET",
			returnType: "Edm.String"
		});
		expect(metadata.functionImports.exportProduct).toMatchObject({
			name: "exportProduct",
			entitySet: "MISSING",
			returnType: "TYPE_SRV.PRODUCT",
			parameters: [
				{
					id: "ID",
					type: "string",
					maxLength: 10,
					mandatory: true
				}
			]
		});
		expect(metadata.functionImports.exportProduct.resultEntity).toBeUndefined();
	});

	it("ошибается на неподдержанном EDM-типе и FunctionImport Mode", () => {
		expect(() => parseServiceMetadata(unsupportedMetadataXml)).toThrow("Неподдерживаемый тип данных Edm.Geography");
		expect(() => parseServiceMetadata(unsupportedFunctionImportModeXml)).toThrow(
			"FunctionImport parameter 'VALUE' uses unsupported Mode='Out'"
		);
		expect(() => parseServiceMetadata(unsupportedFunctionImportTypeXml)).toThrow(
			"FunctionImport parameter 'VALUE' uses unsupported Type='BAD_SRV.Complex'"
		);
	});
});

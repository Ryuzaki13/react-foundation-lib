// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { buildEntityOperationPath, buildEntityPath, buildFunctionImportPath } from "./builder";
import { isForcedCodeTextFamilyId, isForcedCodeTextId, parseServiceMetadata, resolveMetadataColumnLabel } from "./parser";

const zarmMetadataXml = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx">
	<edmx:DataServices xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" m:DataServiceVersion="2.0">
		<Schema Namespace="TEXT_APP_SRV" xmlns="http://schemas.microsoft.com/ado/2008/09/edm" xmlns:sap="http://www.sap.com/Protocols/SAPData">
			<EntityType Name="TEXT_VARIANT" sap:label="Варианты">
				<Key>
					<PropertyRef Name="variantId" />
				</Key>
				<Property Name="variantId" Type="Edm.String" Nullable="false" />
				<Property Name="appId" Type="Edm.String" />
				<Property Name="viewId" Type="Edm.String" />
				<Property Name="variantName" Type="Edm.String" MaxLength="60" sap:label="Имя варианта" />
				<Property Name="isPublic" Type="Edm.String" MaxLength="1" />
			</EntityType>
			<EntityContainer Name="TEXT_APP_SRV_Entities" m:IsDefaultEntityContainer="true">
				<EntitySet Name="TEXT_VARIANT" EntityType="TEXT_APP_SRV.TEXT_VARIANT" />
				<FunctionImport
					Name="setTextVariantDefault"
					ReturnType="TEXT_APP_SRV.TEXT_VARIANT"
					EntitySet="TEXT_VARIANT"
					m:HttpMethod="POST"
					sap:action-for="TEXT_APP_SRV.TEXT_VARIANT">
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
		<Schema Namespace="TEXT_REPORT_SRV" xmlns="http://schemas.microsoft.com/ado/2008/09/edm" xmlns:sap="http://www.sap.com/Protocols/SAPData">
			<EntityType Name="TEXT_REPORT_ENTITY">
				<Key>
					<PropertyRef Name="p_date" />
					<PropertyRef Name="p_date_to" />
					<PropertyRef Name="type_manager" />
				</Key>
				<Property Name="p_date" Type="Edm.DateTime" Nullable="false" sap:parameter="mandatory" />
				<Property Name="p_date_to" Type="Edm.DateTime" Nullable="false" sap:parameter="mandatory" />
				<Property Name="type_manager" Type="Edm.String" Nullable="false" sap:parameter="mandatory" />
				<NavigationProperty Name="Results" Relationship="TEXT_REPORT_SRV.TextResultsAssoc" FromRole="Parameters" ToRole="Results" />
			</EntityType>
			<EntityType Name="TextReportResults">
				<Key>
					<PropertyRef Name="ID" />
				</Key>
				<Property Name="ID" Type="Edm.String" Nullable="false" />
				<Property Name="MANAGER" Type="Edm.String" sap:aggregation-role="dimension" />
				<Property Name="NETWR" Type="Edm.Decimal" sap:aggregation-role="measure" />
			</EntityType>
			<Association Name="TextResultsAssoc">
				<End Type="TEXT_REPORT_SRV.TEXT_REPORT_ENTITY" Role="Parameters" Multiplicity="1" />
				<End Type="TEXT_REPORT_SRV.TextReportResults" Role="Results" Multiplicity="*" />
			</Association>
			<EntityContainer Name="TEXT_REPORT_SRV_Entities" m:IsDefaultEntityContainer="true">
				<EntitySet Name="TEXT_REPORT_ENTITY" EntityType="TEXT_REPORT_SRV.TEXT_REPORT_ENTITY" />
				<EntitySet Name="TextReportResults" EntityType="TEXT_REPORT_SRV.TextReportResults" />
				<AssociationSet Name="TextResultsAssocSet" Association="TEXT_REPORT_SRV.TextResultsAssoc">
					<End Role="Parameters" EntitySet="TEXT_REPORT_ENTITY" />
					<End Role="Results" EntitySet="TextReportResults" />
				</AssociationSet>
			</EntityContainer>
		</Schema>
	</edmx:DataServices>
</edmx:Edmx>`;

const typeCoverageMetadataXml = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx">
	<edmx:DataServices xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" m:DataServiceVersion="2.0">
		<Schema Namespace="TEXT_TYPE_SRV" xmlns="http://schemas.microsoft.com/ado/2008/09/edm" xmlns:sap="http://www.sap.com/Protocols/SAPData">
			<EntityType Name="TEXT_PRODUCT" sap:label="Товары">
				<Key>
					<PropertyRef Name="ID" />
				</Key>
				<Property Name="ID" Type="Edm.String" Nullable="false" sap:label="Код" />
				<Property Name="GUID_TEXT_VALUE" Type="Edm.Guid" />
				<Property Name="FLAG" Type="Edm.Boolean" />
				<Property Name="BYTE_TEXT_VALUE" Type="Edm.Byte" />
				<Property Name="INT_TEXT_VALUE" Type="Edm.Int16" />
				<Property Name="INT32_TEXT_VALUE" Type="Edm.Int32" />
				<Property Name="LONG_TEXT_VALUE" Type="Edm.Int64" />
				<Property Name="FLOAT_TEXT_VALUE" Type="Edm.Single" />
				<Property Name="DECIMAL_TEXT_VALUE" Type="Edm.Decimal" Precision="13" Scale="2" sap:aggregation-role="measure" sap:sortable="false" sap:filterable="false" />
				<Property Name="DOUBLE_TEXT_VALUE" Type="Edm.Double" />
				<Property Name="DATE_TEXT_VALUE" Type="Edm.DateTime" />
				<Property Name="DATETIME_OFFSET_TEXT_VALUE" Type="Edm.DateTimeOffset" />
				<Property Name="TIME_TEXT_VALUE" Type="Edm.Time" />
				<Property Name="BINARY_TEXT_VALUE" Type="Edm.Binary" />
				<Property Name="TEXT_DIVISION" Type="Edm.String" sap:text="zdiv_text" />
				<Property Name="zdiv_text" Type="Edm.String" />
				<Property Name="TEXT_NODE" Type="Edm.String" />
				<Property Name="TEXT_NODE_TEXT" Type="Edm.String" />
				<Property Name="CNT" Type="Edm.Int32" />
				<Property Name="HIDDEN_F" Type="Edm.String" />
				<Property Name="TEXT_COMPLEX" Type="TEXT_TYPE_SRV.TextAddress" />
			</EntityType>
			<EntityType Name="TextReportType" sap:label="Отчёт">
				<Key>
					<PropertyRef Name="P_DATE" />
				</Key>
				<Property Name="P_DATE" Type="Edm.DateTime" Nullable="false" sap:parameter="mandatory" />
				<Property Name="TEXT_VALUE" Type="Edm.Decimal" sap:aggregation-role="measure" />
			</EntityType>
			<EntityContainer Name="TEXT_TYPE_SRV_Entities" m:IsDefaultEntityContainer="true">
				<EntitySet Name="TEXT_PRODUCT" EntityType="TEXT_TYPE_SRV.TEXT_PRODUCT" />
				<EntitySet Name="TEXT_REPORT" EntityType="TEXT_TYPE_SRV.TextReportType" />
				<FunctionImport Name="ping" ReturnType="Edm.String" m:HttpMethod="GET" />
				<FunctionImport Name="exportProduct" EntitySet="TEXT_MISSING" ReturnType="TEXT_TYPE_SRV.TEXT_PRODUCT">
					<Parameter Name="ID" Type="Edm.String" Nullable="false" MaxLength="10" />
				</FunctionImport>
			</EntityContainer>
		</Schema>
	</edmx:DataServices>
</edmx:Edmx>`;

const unsupportedMetadataXml = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx">
	<edmx:DataServices xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" m:DataServiceVersion="2.0">
		<Schema Namespace="TEXT_INVALID_SRV" xmlns="http://schemas.microsoft.com/ado/2008/09/edm">
			<EntityType Name="TEXT_INVALID">
				<Property Name="TEXT_VALUE" Type="Edm.Geography" />
			</EntityType>
			<EntityContainer Name="TEXT_INVALID_SRV_Entities">
				<EntitySet Name="TEXT_INVALID" EntityType="TEXT_INVALID_SRV.TEXT_INVALID" />
				<FunctionImport Name="badMode">
					<Parameter Name="TEXT_VALUE" Type="Edm.String" Mode="Out" />
				</FunctionImport>
			</EntityContainer>
		</Schema>
	</edmx:DataServices>
</edmx:Edmx>`;

const unsupportedFunctionImportTypeXml = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx">
	<edmx:DataServices xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" m:DataServiceVersion="2.0">
		<Schema Namespace="TEXT_INVALID_SRV" xmlns="http://schemas.microsoft.com/ado/2008/09/edm">
			<EntityContainer Name="TEXT_INVALID_SRV_Entities">
				<FunctionImport Name="badType">
					<Parameter Name="TEXT_VALUE" Type="TEXT_INVALID_SRV.Complex" Mode="In" />
				</FunctionImport>
			</EntityContainer>
		</Schema>
	</edmx:DataServices>
</edmx:Edmx>`;

const unsupportedFunctionImportModeXml = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx">
	<edmx:DataServices xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" m:DataServiceVersion="2.0">
		<Schema Namespace="TEXT_INVALID_SRV" xmlns="http://schemas.microsoft.com/ado/2008/09/edm">
			<EntityContainer Name="TEXT_INVALID_SRV_Entities">
				<FunctionImport Name="badMode">
					<Parameter Name="TEXT_VALUE" Type="Edm.String" Mode="Out" />
				</FunctionImport>
			</EntityContainer>
		</Schema>
	</edmx:DataServices>
</edmx:Edmx>`;

describe("odata metadata parser / canonical target", () => {
	it("возвращает label колонки и forced code/text family flags", () => {
		expect(resolveMetadataColumnLabel({ id: "ID", label: "Код" })).toBe("Код");
		expect(resolveMetadataColumnLabel({ id: "ID", label: "" })).toBe("ID");
		expect(isForcedCodeTextId("text_division")).toBe(true);
		expect(isForcedCodeTextFamilyId("text_node_text")).toBe(true);
		expect(isForcedCodeTextFamilyId("unknown_text")).toBe(false);
		expect(isForcedCodeTextId(undefined)).toBe(false);
	});

	it("парсит entity и FunctionImport по каноническим именам из metadata", () => {
		const metadata = parseServiceMetadata(zarmMetadataXml);
		const functionImport = metadata.functionImports.setTextVariantDefault;

		expect(Object.keys(metadata.entities)).toContain("TEXT_VARIANT");
		expect(metadata.entities).not.toHaveProperty("TEXT_UI_VARIANT");
		expect(functionImport).toMatchObject({
			name: "setTextVariantDefault",
			httpMethod: "POST",
			entitySet: "TEXT_VARIANT",
			actionFor: "TEXT_APP_SRV.TEXT_VARIANT",
			returnType: "TEXT_APP_SRV.TEXT_VARIANT",
			resultEntity: "TEXT_VARIANT"
		});

		expect(functionImport.parameters?.map((parameter) => parameter.id)).toEqual(["variantId", "appId", "viewId"]);
		expect(functionImport.parameters?.find((parameter) => parameter.id === "variantId")?.mandatory).toBe(true);
		expect(functionImport.parameters?.find((parameter) => parameter.id === "appId")?.mandatory).toBeUndefined();
	});

	it("сохраняет derived-признак abapBooleanLike для string(1)", () => {
		const metadata = parseServiceMetadata(zarmMetadataXml);
		const isPublicColumn = metadata.entities.TEXT_VARIANT.columns.find((column) => column.id === "isPublic");
		const variantNameColumn = metadata.entities.TEXT_VARIANT.columns.find((column) => column.id === "variantName");

		expect(isPublicColumn?.abapBooleanLike).toBe(true);
		expect(variantNameColumn?.abapBooleanLike).toBeUndefined();
	});

	it("строит entity path из канонического target без автодобавления Set", () => {
		const metadata = parseServiceMetadata(zarmMetadataXml);
		const entity = metadata.entities.TEXT_VARIANT;

		expect(buildEntityPath(entity, { service: "TEXT_APP_SRV", target: "TEXT_VARIANT" }, { variantId: { value: "uuid-1" } })).toBe(
			"/TEXT_APP_SRV/TEXT_VARIANT(variantId='uuid-1')"
		);
	});

	it("строит operation path для create без параметров", () => {
		const metadata = parseServiceMetadata(zarmMetadataXml);
		const entity = metadata.entities.TEXT_VARIANT;

		expect(buildEntityOperationPath(entity, { service: "TEXT_APP_SRV", target: "TEXT_VARIANT" }, {}, "create")).toBe(
			"/TEXT_APP_SRV/TEXT_VARIANT"
		);
	});

	it("строит query string path для FunctionImport через target", () => {
		const metadata = parseServiceMetadata(zarmMetadataXml);
		const functionImport = metadata.functionImports.setTextVariantDefault;

		expect(
			buildFunctionImportPath(
				functionImport,
				{ service: "TEXT_APP_SRV", target: "setTextVariantDefault" },
				{
					variantId: { value: "uuid-1" },
					appId: { value: "app" },
					viewId: { value: "main" }
				}
			)
		).toBe("/TEXT_APP_SRV/setTextVariantDefault?variantId=%27uuid-1%27&appId=%27app%27&viewId=%27main%27");
	});

	it("требует обязательные параметры FunctionImport", () => {
		const metadata = parseServiceMetadata(zarmMetadataXml);
		const functionImport = metadata.functionImports.setTextVariantDefault;

		expect(() =>
			buildFunctionImportPath(
				functionImport,
				{ service: "TEXT_APP_SRV", target: "setTextVariantDefault" },
				{
					appId: { value: "app" },
					viewId: { value: "main" }
				}
			)
		).toThrow("Отсутствует обязательный параметр: variantId");
	});

	it("публикует параметризованный CDS target, но не публикует связанный Results-target отдельно", () => {
		const metadata = parseServiceMetadata(salesMetadataXml);
		const entity = metadata.entities.TEXT_REPORT_ENTITY;

		expect(metadata.entities).toHaveProperty("TEXT_REPORT_ENTITY");
		expect(metadata.entities).not.toHaveProperty("TextReportResults");
		expect(entity?.result).toBe("Results");
		expect(entity?.parameters?.map((parameter) => parameter.id)).toEqual(["p_date", "p_date_to", "type_manager"]);
		expect(entity?.columns.length).toBeGreaterThan(0);
	});

	it("строит operation path для query parameterized entity с suffix результата", () => {
		const metadata = parseServiceMetadata(salesMetadataXml);
		const entity = metadata.entities.TEXT_REPORT_ENTITY;

		expect(
			buildEntityOperationPath(
				entity,
				{ service: "TEXT_REPORT_SRV", target: "TEXT_REPORT_ENTITY" },
				{
					p_date: { value: new Date("2024-01-01T00:00:00.000Z") },
					p_date_to: { value: new Date("2024-01-31T00:00:00.000Z") },
					type_manager: { value: "MAIN" }
				},
				"query"
			)
		).toContain("/TEXT_REPORT_SRV/TEXT_REPORT_ENTITY(");
		expect(
			buildEntityOperationPath(
				entity,
				{ service: "TEXT_REPORT_SRV", target: "TEXT_REPORT_ENTITY" },
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
		const product = metadata.entities.TEXT_PRODUCT;
		const columnsById = Object.fromEntries(product.columns.map((column) => [column.id, column]));

		expect(product.title).toBe("Товары");
		expect(product.parameters?.find((parameter) => parameter.id === "ID")?.mandatory).toBe(true);
		expect(columnsById.ID).toMatchObject({ label: "Код", type: "string", role: "dimension", semanticType: "code" });
		expect(columnsById.GUID_TEXT_VALUE?.type).toBe("guid");
		expect(columnsById.FLAG?.type).toBe("boolean");
		expect(columnsById.BYTE_TEXT_VALUE?.type).toBe("byte");
		expect(columnsById.INT_TEXT_VALUE?.type).toBe("int");
		expect(columnsById.INT32_TEXT_VALUE?.type).toBe("int");
		expect(columnsById.LONG_TEXT_VALUE?.type).toBe("long");
		expect(columnsById.FLOAT_TEXT_VALUE?.type).toBe("float");
		expect(columnsById.DOUBLE_TEXT_VALUE?.type).toBe("double");
		expect(columnsById.DATE_TEXT_VALUE?.type).toBe("datetime");
		expect(columnsById.DATETIME_OFFSET_TEXT_VALUE?.type).toBe("datetimeOffset");
		expect(columnsById.TIME_TEXT_VALUE?.type).toBe("time");
		expect(columnsById.BINARY_TEXT_VALUE?.type).toBe("binary");
		expect(columnsById.DECIMAL_TEXT_VALUE).toMatchObject({
			type: "decimal",
			precision: 13,
			scale: 2,
			role: "measure",
			semanticType: "none",
			sortable: false,
			filterable: false
		});
		expect(columnsById.TEXT_DIVISION).toMatchObject({ semanticType: "code", linkedColumnId: "zdiv_text" });
		expect(columnsById.zdiv_text).toMatchObject({ semanticType: "text", linkedColumnId: "TEXT_DIVISION" });
		expect(columnsById.TEXT_NODE).toMatchObject({ semanticType: "code", linkedColumnId: "TEXT_NODE_TEXT" });
		expect(columnsById.TEXT_NODE_TEXT).toMatchObject({ semanticType: "text", linkedColumnId: "TEXT_NODE" });
		expect(product.columns.map((column) => column.id)).not.toEqual(expect.arrayContaining(["CNT", "HIDDEN_F", "TEXT_COMPLEX"]));
	});

	it("не создаёт parameters для EntityType с суффиксом Type без result navigation", () => {
		const metadata = parseServiceMetadata(typeCoverageMetadataXml);

		expect(metadata.entities.TEXT_REPORT.parameters).toBeUndefined();
		expect(metadata.entities.TEXT_REPORT.columns.map((column) => column.id)).toEqual(["P_DATE", "TEXT_VALUE"]);
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
			entitySet: "TEXT_MISSING",
			returnType: "TEXT_TYPE_SRV.TEXT_PRODUCT",
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
			"FunctionImport parameter 'TEXT_VALUE' uses unsupported Mode='Out'"
		);
		expect(() => parseServiceMetadata(unsupportedFunctionImportTypeXml)).toThrow(
			"FunctionImport parameter 'TEXT_VALUE' uses unsupported Type='TEXT_INVALID_SRV.Complex'"
		);
	});
});

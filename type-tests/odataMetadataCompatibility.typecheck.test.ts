import { type TableExcelColumnDescriptor } from "../src/excel/tableExport";
import { type FormattersPipelineTypedValueContext } from "../src/formatters/pipeline/types";
import {
	type BaseMetaType,
	type ColumnRole,
	type ODataBooleanType,
	type ODataDateType,
	type ODataIntegerType,
	type ODataMetaType,
	type ODataNumericType,
	type ODataStringType
} from "../src/odata-service";

type Equal<Left, Right> = (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2 ? true : false;
type Assert<Value extends true> = Value;

/** Перенос владельца не меняет допустимые значения опубликованных контрактов метаданных. */
export type ODataMetadataCompatibility = [
	Assert<Equal<BaseMetaType, "string" | "number" | "boolean" | "date">>,
	Assert<Equal<ColumnRole, "measure" | "dimension">>,
	Assert<Equal<ODataBooleanType, "boolean">>,
	Assert<Equal<ODataNumericType, "byte" | "int" | "long" | "float" | "decimal" | "double">>,
	Assert<Equal<ODataIntegerType, "byte" | "int" | "long">>,
	Assert<Equal<ODataDateType, "datetime" | "datetimeOffset" | "time">>,
	Assert<Equal<ODataStringType, "string" | "guid" | "binary">>,
	Assert<Equal<ODataMetaType, ODataBooleanType | ODataNumericType | ODataDateType | ODataStringType>>,
	Assert<Equal<FormattersPipelineTypedValueContext["type"], ODataMetaType>>,
	Assert<Equal<TableExcelColumnDescriptor["odataType"], ODataMetaType | undefined>>
];

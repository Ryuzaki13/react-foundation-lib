import { type ODataBooleanType, type ODataDateType, type ODataIntegerType, type ODataMetaType, type ODataNumericType } from "./types";

export function isODataBooleanType(type: ODataMetaType | undefined): type is ODataBooleanType {
	return type === "boolean";
}

export function isODataNumericType(type: ODataMetaType | undefined): type is ODataNumericType {
	return type === "byte" || type === "int" || type === "long" || type === "float" || type === "decimal" || type === "double";
}

export function isODataIntegerType(type: ODataMetaType | undefined): type is ODataIntegerType {
	return type === "byte" || type === "int" || type === "long";
}

export function isODataDateType(type: ODataMetaType | undefined): type is ODataDateType {
	return type === "datetime" || type === "datetimeOffset" || type === "time";
}

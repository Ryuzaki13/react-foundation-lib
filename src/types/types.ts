import { type ABAP_BOOLEAN_FALSE, type ABAP_BOOLEAN_TRUE } from "./abapBooleanConstants";
import {
	type VALUE_STATE_EMPTY,
	type VALUE_STATE_ERROR,
	type VALUE_STATE_INFORMATION,
	type VALUE_STATE_NONE,
	type VALUE_STATE_SUCCESS,
	type VALUE_STATE_WARNING
} from "./valueStateConstants";

export type State =
	| typeof VALUE_STATE_EMPTY
	| typeof VALUE_STATE_NONE
	| typeof VALUE_STATE_INFORMATION
	| typeof VALUE_STATE_SUCCESS
	| typeof VALUE_STATE_WARNING
	| typeof VALUE_STATE_ERROR;

export type AbapBoolean = typeof ABAP_BOOLEAN_TRUE | typeof ABAP_BOOLEAN_FALSE;

export type Primitive = string | number | boolean | null | undefined;
export type BaseType = Date | Primitive;

export function isBaseType(value: unknown): value is BaseType {
	if (value === null || value === undefined) return true;
	if (value instanceof Date) return Number.isFinite(value.getTime());
	if (typeof value === "number") return Number.isFinite(value);

	return typeof value === "string" || typeof value === "boolean";
}

export type ArrayType = BaseType[];
export type ObjectType = Readonly<Record<string, BaseType>> | object;
export type InputType = BaseType | ArrayType | ObjectType;

export type RangeType = readonly [BaseType | null, BaseType | null];

export type RowRecord = Record<string, unknown>;

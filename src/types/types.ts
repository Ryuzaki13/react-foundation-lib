export type State = "" | "none" | "information" | "success" | "warning" | "error";

export type AbapBoolean = "X" | " ";

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

// Тип для обработчиков изменений
export type ChangeHandler<T extends InputType> = (value: T) => void;

export type RowRecord = Record<string, unknown>;

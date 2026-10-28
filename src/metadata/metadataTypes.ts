import {
	type BASE_META_TYPE_DATE,
	type BASE_META_TYPE_NUMBER,
	type SCALAR_ROLE_DIMENSION,
	type SCALAR_ROLE_MEASURE,
	type SCALAR_TYPE_BINARY,
	type SCALAR_TYPE_BOOLEAN,
	type SCALAR_TYPE_BYTE,
	type SCALAR_TYPE_DATETIME,
	type SCALAR_TYPE_DATETIME_OFFSET,
	type SCALAR_TYPE_DECIMAL,
	type SCALAR_TYPE_DOUBLE,
	type SCALAR_TYPE_FLOAT,
	type SCALAR_TYPE_GUID,
	type SCALAR_TYPE_INT,
	type SCALAR_TYPE_LONG,
	type SCALAR_TYPE_STRING,
	type SCALAR_TYPE_TIME
} from "./scalarTypeConstants";

/**
 * Внутренняя классификация скалярных значений таблиц, форм и экспорта. Здесь нет
 * EDMX, литералов URL, Zod-схем и состояния OData: протокольные адаптеры зависят
 * от этих типов, а общие сценарии не зависят от протокольной точки входа.
 * Набор значений сохранён точно, поскольку он уже входит в опубликованные контракты.
 */
export type BaseMetaType =
	typeof SCALAR_TYPE_STRING | typeof BASE_META_TYPE_NUMBER | typeof SCALAR_TYPE_BOOLEAN | typeof BASE_META_TYPE_DATE;

export type BooleanMetaType = typeof SCALAR_TYPE_BOOLEAN;
export type NumericMetaType =
	| typeof SCALAR_TYPE_BYTE
	| typeof SCALAR_TYPE_INT
	| typeof SCALAR_TYPE_LONG
	| typeof SCALAR_TYPE_FLOAT
	| typeof SCALAR_TYPE_DECIMAL
	| typeof SCALAR_TYPE_DOUBLE;
export type IntegerMetaType = Extract<NumericMetaType, typeof SCALAR_TYPE_BYTE | typeof SCALAR_TYPE_INT | typeof SCALAR_TYPE_LONG>;
export type DateMetaType = typeof SCALAR_TYPE_DATETIME | typeof SCALAR_TYPE_DATETIME_OFFSET | typeof SCALAR_TYPE_TIME;
export type StringMetaType = typeof SCALAR_TYPE_STRING | typeof SCALAR_TYPE_GUID | typeof SCALAR_TYPE_BINARY;
export type ScalarMetaType = BooleanMetaType | NumericMetaType | DateMetaType | StringMetaType;

/** Роль поля в аналитическом представлении не зависит от протокола получения данных. */
export type ColumnRole = typeof SCALAR_ROLE_MEASURE | typeof SCALAR_ROLE_DIMENSION;

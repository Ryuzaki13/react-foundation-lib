/**
 * Внутренняя классификация скалярных значений таблиц, форм и экспорта. Здесь нет
 * EDMX, литералов URL, Zod-схем и состояния OData: протокольные адаптеры зависят
 * от этих типов, а общие сценарии не зависят от протокольной точки входа.
 * Набор значений сохранён точно, поскольку он уже входит в опубликованные контракты.
 */
export type BaseMetaType = "string" | "number" | "boolean" | "date";

export type BooleanMetaType = "boolean";
export type NumericMetaType = "byte" | "int" | "long" | "float" | "decimal" | "double";
export type IntegerMetaType = Extract<NumericMetaType, "byte" | "int" | "long">;
export type DateMetaType = "datetime" | "datetimeOffset" | "time";
export type StringMetaType = "string" | "guid" | "binary";
export type ScalarMetaType = BooleanMetaType | NumericMetaType | DateMetaType | StringMetaType;

/** Роль поля в аналитическом представлении не зависит от протокола получения данных. */
export type ColumnRole = "measure" | "dimension";

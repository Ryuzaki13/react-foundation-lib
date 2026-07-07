// Базовый тип для поисковых параметров
export type ParamValue = string | number | boolean;
export type SearchParams<K extends PropertyKey> = Partial<Record<K, string>>;
export type SearchParamsUpdater<K extends PropertyKey> = Partial<Record<K, ParamValue>>;

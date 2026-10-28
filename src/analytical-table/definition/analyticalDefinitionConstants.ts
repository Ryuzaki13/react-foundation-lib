/** Операции агрегации общие для описания поля и исполняющего их runtime. */
export const ANALYTICAL_AGGREGATION_SUM = "sum";
export const ANALYTICAL_AGGREGATION_MIN = "min";
export const ANALYTICAL_AGGREGATION_MAX = "max";
export const ANALYTICAL_AGGREGATION_AVG = "avg";
export const ANALYTICAL_AGGREGATION_COUNT = "count";

/** Контекст callback итогов отделён от вида строки, даже когда значения совпадают. */
export const ANALYTICAL_AGGREGATE_SCOPE_GROUP = "group";
export const ANALYTICAL_AGGREGATE_SCOPE_GRAND = "grand";
export const ANALYTICAL_TOTALS_SCOPE_ALL = "all";
export const ANALYTICAL_TOTALS_SCOPE_FILTERED = "filtered";

/** Типы значений описания не зависят от JavaScript typeof конкретного значения. */
export const ANALYTICAL_VALUE_TYPE_STRING = "string";
export const ANALYTICAL_VALUE_TYPE_NUMBER = "number";
export const ANALYTICAL_VALUE_TYPE_BOOLEAN = "boolean";
export const ANALYTICAL_VALUE_TYPE_DATE = "date";

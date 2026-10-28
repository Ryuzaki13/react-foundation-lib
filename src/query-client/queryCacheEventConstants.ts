/** Значения cache events и wire-команд сохраняют протокол межвкладочного обмена. */
export const QUERY_CACHE_EVENT_UPDATED = "updated";
export const QUERY_CACHE_ACTION_INVALIDATE = "invalidate";
export const QUERY_CACHE_EVENT_SET_DATA = "setQueryData";
export const QUERY_INVALIDATION_MESSAGE_TYPE = "query.invalidate";

/** Режимы TanStack Query разделяют инвалидацию и немедленный refetch. */
export const QUERY_REFETCH_NONE = "none";
export const QUERY_REFETCH_ACTIVE = "active";
export const QUERY_REFETCH_INACTIVE = "inactive";
export const QUERY_REFETCH_ALL = "all";

/** Значения capture-контракта общие для producers, runtime schema и публичных типов. */
export const ERROR_REPORT_CATEGORY_QUERY = "query";
export const ERROR_REPORT_CATEGORY_MUTATION = "mutation";
export const ERROR_REPORT_CATEGORY_RUNTIME = "runtime";
export const ERROR_REPORT_CATEGORY_REACT = "react";

/** Fallback source не связывается с категорией: caller может задавать их независимо. */
export const ERROR_REPORT_SOURCE_MUTATION = "mutation";

export const ERROR_REPORT_STATUS_PENDING = "pending";
export const ERROR_REPORT_STATUS_SENDING = "sending";
export const ERROR_REPORT_STATUS_SENT = "sent";
export const ERROR_REPORT_STATUS_FAILED = "failed";

export const ERROR_REPORT_BREADCRUMB_ROUTE = "route";
export const ERROR_REPORT_BREADCRUMB_CLICK = "click";
export const ERROR_REPORT_BREADCRUMB_VISIBILITY = "visibility";
export const ERROR_REPORT_BREADCRUMB_QUERY_ERROR = "query-error";
export const ERROR_REPORT_BREADCRUMB_MUTATION_ERROR = "mutation-error";
export const ERROR_REPORT_BREADCRUMB_RUNTIME_ERROR = "runtime-error";

export const ERROR_REPORT_MODE_DEVELOPMENT = "development";
export const ERROR_REPORT_MODE_PRODUCTION = "production";

export const ERROR_REPORT_SCOPE_BREADCRUMB_DETAIL = "breadcrumb-detail";
export const ERROR_REPORT_SCOPE_CONTEXT = "context";
export const ERROR_REPORT_SCOPE_DRAFT_FAILED_REASON = "draft-failed-reason";
export const ERROR_REPORT_SCOPE_ERROR_MESSAGE = "error-message";
export const ERROR_REPORT_SCOPE_MUTATION_KEY = "mutation-key";
export const ERROR_REPORT_SCOPE_MUTATION_META = "mutation-meta";
export const ERROR_REPORT_SCOPE_PERSISTED_QUERY_KEY = "persisted-query-key";
export const ERROR_REPORT_SCOPE_QUERY_DATA_SHAPE = "query-data-shape";
export const ERROR_REPORT_SCOPE_QUERY_KEY = "query-key";
export const ERROR_REPORT_SCOPE_QUERY_META = "query-meta";
export const ERROR_REPORT_SCOPE_STACK_TRACE = "stack-trace";

export const ERROR_REPORT_TRUNCATION_PAYLOAD_SIZE = "payload-size";

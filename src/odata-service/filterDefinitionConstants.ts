/** Внутренние дискриминанты связывают типы фильтров, нормализацию и компиляцию. */
export const FILTER_KIND_SEGMENT = "segment";
export const FILTER_KIND_TREE = "tree";
export const FILTER_KIND_ADVANCED = "advanced";
export const FILTER_KIND_LOCAL = "local";
export const FILTER_KIND_REGISTERED = "registered";
export const FILTER_KIND_COLUMN = "column";

export const FILTER_BINDING_LIST = "list";
export const FILTER_BINDING_BOOLEAN = "boolean";
export const FILTER_BINDING_VALUE = "value";
export const FILTER_VALUE_SOURCE_STATIC = "static";
export const FILTER_VALUE_SOURCE_INPUT = "input";
export const FILTER_VALUE_MODE_SINGLE = "single";
export const FILTER_VALUE_MODE_MULTIPLE = "multiple";

/** Только встроенные component id; зарегистрированные consumer id остаются непрозрачными. */
export const FILTER_COMPONENT_SELECT = "select";
export const FILTER_COMPONENT_MULTI_SELECT = "multi-select";
export const FILTER_COMPONENT_TREE_SELECT = "tree-select";
export const FILTER_COMPONENT_TREE_MULTI_SELECT = "tree-multi-select";
export const FILTER_COMPONENT_CHECKBOX = "checkbox";
export const FILTER_COMPONENT_TEXT_INPUT = "text-input";
export const FILTER_COMPONENT_NUMBER_INPUT = "number-input";
export const FILTER_COMPONENT_ADVANCED_SEARCH_SELECT = "advanced-search-select";

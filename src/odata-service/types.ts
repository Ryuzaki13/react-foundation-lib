import { type BaseType, type InputType } from "../types";

/**
 * Базовые типы с которыми работают UI компоненты.
 */
export type BaseMetaType = "string" | "number" | "boolean" | "date";

export type ODataBooleanType = "boolean";
export type ODataNumericType = "byte" | "int" | "long" | "float" | "decimal" | "double";
export type ODataIntegerType = Extract<ODataNumericType, "byte" | "int" | "long">;
export type ODataDateType = "datetime" | "datetimeOffset" | "time";
export type ODataStringType = "string" | "guid" | "binary";

export type BaseMethod = "GET" | "POST" | "PUT" | "DELETE";
export type ODataOperationMethod = "create" | "update" | "delete" | "read" | "query" | "fi";

/**
 * Типы данных сервисов OData (параметры, поля)
 */
export type ODataMetaType = ODataBooleanType | ODataNumericType | ODataDateType | ODataStringType;

export type ODataFormatterFn = (...args: unknown[]) => string;
export type ODataFormatterDescription = {
	id: string;

	label: string;
	description: string;
	fn: ODataFormatterFn;

	/**
	 *
	 */
	// handles?: string[];
};

/**
 * Базовое представление значения входящего одного odata параметра
 */
export type ODataParameterValue = BaseType | BaseType[];

/**
 * Значение одного OData-параметра до финального форматирования.
 *
 * Массив допустим только как вход custom formatter-а: сам OData-параметр
 * остаётся scalar и formatter обязан преобразовать весь массив в строковый
 * литерал, который понимают OData и конкретный SAP Gateway endpoint.
 */
export type ODataValue<T extends ODataParameterValue = BaseType> = {
	value: T;
	formatter?: ODataFormatterFn;
};

/**
 * Для odataParameterMapping редактора!
 */
export type InputValue<T extends InputType = InputType> = {
	value: T;
	formatter?: ODataFormatterFn;
};

/**
 * Плоская структура параметров:
 * {
 *   p_vbeln: string;
 *   p_dokar: string;
 * }
 */
export type UnwrappedODataParameters = Record<string, ODataParameterValue>;
export type UnwrappedInputParameters = Record<string, InputType>;

/**
 * Обёрнутая структура параметров:
 * {
 *   p_vbeln: { value: string };
 *   p_dokar: { value: string };
 * }
 */
export type WrappedODataParameters = Record<string, ODataValue<ODataParameterValue>>;
export type WrappedInputParameters = Record<string, InputValue>;

/**
 * Преобразует плоский тип в wrapped-тип.
 */
export type WrapODataParameters<T extends UnwrappedODataParameters> = {
	[K in keyof T]: ODataValue<T[K] | null | undefined>;
	// {
	// 	value: T[K] | null | undefined;
	// 	formatter?: ODataFormatterFn;
	// };
};

/**
 * Обратное преобразование wrapped -> unwrapped.
 * Может пригодиться дальше.
 */
export type UnwrapODataParameters<T extends WrappedODataParameters> = {
	[K in keyof T]: T[K]["value"];
};

/**
 * Конфигурация сервиса OData
 */
export interface ODataServiceConfig {
	/**
	 * Имя OData сервиса, например, `TEXT_REPORT_SRV`
	 */
	service: string;

	/**
	 * Имя сущности сервиса OData (EntitySet), например, `TEXT_REPORT_MEASURE`
	 */
	target: string;
}

export type EntityPropertyBase = {
	/** Идентификатор параметра */
	id: string;
	/** Метка/название */
	label: string;
};

export type EntityPropertyBaseWithType = EntityPropertyBase & {
	/** Тип данных */
	type: ODataMetaType;
};

/**
 * Свойство параметра сущности
 */
export type EntityParameterProperty = EntityPropertyBaseWithType & {
	/** Оригинальный тип из EDMX */
	originalType: string;
	abapBooleanLike?: true;
	/** Может ли быть null */
	nullable?: true;
	/** Обязательный параметр */
	mandatory?: true;
	/** Максимальная длина строки */
	maxLength?: number;
	/** Точность для чисел */
	precision?: number;
	/** Количество знаков после запятой для decimal */
	scale?: number;
	/** Тип параметра в терминах SAP */
	parameter?: string;
};

export type ColumnRole = "measure" | "dimension";

/**
 * Свойство колонки сущности
 */
export type EntityColumnProperty = Omit<EntityParameterProperty, "nullable" | "mandatory"> & {
	/** Связанная колонка в паре code <-> text */
	linkedColumnId?: string;
	/** Семантика колонки относительно пары code/text */
	semanticType: "none" | "code" | "text";
	/** Можно ли сортировать */
	sortable: boolean;
	/** Можно ли фильтровать */
	filterable: boolean;
	/** Роль в аналитике */
	role: ColumnRole;
};

/**
 * Метаданные сущности
 */
export type EntityMetadata = {
	/** Заголовок сущности */
	title: string;
	/** Колонки сущности */
	columns: EntityColumnProperty[];
	/** Параметры сущности (если есть) */
	parameters?: EntityParameterProperty[];

	result?: "Set" | "Results";
};

export type ServiceEntities = Record<string, EntityMetadata>;
export type FunctionImportMetadata = {
	name: string;
	title: string;
	httpMethod?: BaseMethod;
	parameters?: EntityParameterProperty[];
	returnType: string;
	entitySet?: string;
	actionFor?: string;
	resultEntity?: string;
};

export type ServiceFunctionImports = Record<string, FunctionImportMetadata>;
export type ODataTargetMetadata = EntityMetadata | FunctionImportMetadata;

/**
 * Метаданные всего сервиса
 */
export type ServiceMetadata = {
	/** Все сущности сервиса */
	entities: ServiceEntities;
	functionImports: ServiceFunctionImports;
};

export type ODataChainItem = { codeKey: string; count: number };
export type ODataChainsMap = Record<string, ODataChainItem[]>;

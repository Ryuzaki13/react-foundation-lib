// Действующий опубликованный контракт использует общую реализацию проверок типов.
export {
	isScalarBooleanType as isODataBooleanType,
	isScalarDateType as isODataDateType,
	isScalarIntegerType as isODataIntegerType,
	isScalarNumericType as isODataNumericType
} from "../metadata/scalarTypeClassification";

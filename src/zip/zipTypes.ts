import { type ZIP_COMPRESSION_DEFLATE, type ZIP_COMPRESSION_STORE } from "./zipConstants";

/** Готовое содержимое и точное имя файла в корне архива; File также подходит как Blob. */
export type ZipFile = {
	readonly blob: Blob;
	readonly filename: string;
};

/** Упаковка не скачивает результат и не управляет состоянием пользовательского интерфейса. */
export type CreateZipBlobOptions = {
	/** По умолчанию store без сжатия; deflate требует нативный CompressionStream("deflate-raw"). */
	readonly compression?: typeof ZIP_COMPRESSION_STORE | typeof ZIP_COMPRESSION_DEFLATE;
	/** Отмена отклоняет Promise исходным signal.reason и останавливает дальнейшую обработку. */
	readonly signal?: AbortSignal;
};

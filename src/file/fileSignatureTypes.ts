import {
	type FILE_SIGNATURE_EXTENSION_RAR,
	type FILE_SIGNATURE_EXTENSION_SEVEN_ZIP,
	type FILE_SIGNATURE_EXTENSION_ZIP,
	type FILE_SIGNATURE_RESULT_MATCH,
	type FILE_SIGNATURE_RESULT_MISMATCH,
	type FILE_SIGNATURE_RESULT_UNSUPPORTED
} from "./fileSignatureConstants";

/** Bytes принадлежат caller; расширение передаётся без точки и имени файла. */
export type FileSignatureCheckOptions = Readonly<{
	extension: string;
	bytes: Uint8Array;
}>;

/**
 * match подтверждает только поддержанный header, не целостность или безопасность
 * файла. unsupported означает отсутствие надёжного решения этой проверкой;
 * допустимость такого файла определяет вызывающая policy, а не foundation.
 */
export type FileSignatureCheckResult =
	typeof FILE_SIGNATURE_RESULT_MATCH | typeof FILE_SIGNATURE_RESULT_MISMATCH | typeof FILE_SIGNATURE_RESULT_UNSUPPORTED;

/** Внутренний archive dispatch; public index не публикует этот тип. */
export type ArchiveFileSignatureExtension =
	typeof FILE_SIGNATURE_EXTENSION_RAR | typeof FILE_SIGNATURE_EXTENSION_ZIP | typeof FILE_SIGNATURE_EXTENSION_SEVEN_ZIP;

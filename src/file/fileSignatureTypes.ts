import { type FILE_SIGNATURE_EXTENSION, type FILE_SIGNATURE_RESULT } from "./fileSignatureConstants";

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
export type FileSignatureCheckResult = (typeof FILE_SIGNATURE_RESULT)[keyof typeof FILE_SIGNATURE_RESULT];

/** Внутренний archive dispatch; public index не публикует этот тип. */
export type ArchiveFileSignatureExtension =
	typeof FILE_SIGNATURE_EXTENSION.RAR | typeof FILE_SIGNATURE_EXTENSION.ZIP | typeof FILE_SIGNATURE_EXTENSION.SEVEN_ZIP;

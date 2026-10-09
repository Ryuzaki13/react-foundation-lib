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
export type FileSignatureCheckResult = "match" | "mismatch" | "unsupported";

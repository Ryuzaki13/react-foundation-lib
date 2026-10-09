/** Приватный словарь результатов; значения сохраняют публичный string union. */
export const FILE_SIGNATURE_RESULT = {
	MATCH: "match",
	MISMATCH: "mismatch",
	UNSUPPORTED: "unsupported"
} as const;

/** Только dispatch поддержанных проверок; это не предметный allowlist caller. */
export const FILE_SIGNATURE_EXTENSION = {
	PNG: "png",
	JPG: "jpg",
	JPEG: "jpeg",
	BMP: "bmp",
	PSD: "psd",
	RTF: "rtf",
	RAR: "rar",
	ZIP: "zip",
	SEVEN_ZIP: "7z",
	PDF: "pdf"
} as const;

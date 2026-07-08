const EXTENSION_CONTENT_TYPE: Readonly<Record<string, string>> = {
	pdf: "application/pdf",
	doc: "application/msword",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	xls: "application/vnd.ms-excel",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	ppt: "application/vnd.ms-powerpoint",
	pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	txt: "text/plain; charset=UTF-8",
	rtf: "application/rtf",
	odt: "application/vnd.oasis.opendocument.text",
	zip: "application/zip",
	rar: "application/vnd.rar",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	gif: "image/gif",
	webp: "image/webp"
};

export function resolveMimeTypeByExtension(extension: string): string {
	const normalizedExtension = extension.trim().toLowerCase();

	return EXTENSION_CONTENT_TYPE[normalizedExtension] ?? "application/octet-stream";
}

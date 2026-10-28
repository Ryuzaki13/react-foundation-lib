import {
	MIME_TYPE_DOCX,
	MIME_TYPE_IMAGE_GIF,
	MIME_TYPE_IMAGE_JPEG,
	MIME_TYPE_IMAGE_PNG,
	MIME_TYPE_IMAGE_WEBP,
	MIME_TYPE_MSWORD,
	MIME_TYPE_OCTET_STREAM,
	MIME_TYPE_PDF,
	MIME_TYPE_PPT,
	MIME_TYPE_PPTX,
	MIME_TYPE_TEXT_PLAIN_UTF8,
	MIME_TYPE_XLS,
	MIME_TYPE_XLSX,
	MIME_TYPE_ZIP
} from "./mimeTypeConstants";

const EXTENSION_CONTENT_TYPE: Readonly<Record<string, string>> = {
	pdf: MIME_TYPE_PDF,
	doc: MIME_TYPE_MSWORD,
	docx: MIME_TYPE_DOCX,
	xls: MIME_TYPE_XLS,
	xlsx: MIME_TYPE_XLSX,
	ppt: MIME_TYPE_PPT,
	pptx: MIME_TYPE_PPTX,
	txt: MIME_TYPE_TEXT_PLAIN_UTF8,
	rtf: "application/rtf",
	odt: "application/vnd.oasis.opendocument.text",
	zip: MIME_TYPE_ZIP,
	rar: "application/vnd.rar",
	jpg: MIME_TYPE_IMAGE_JPEG,
	jpeg: MIME_TYPE_IMAGE_JPEG,
	png: MIME_TYPE_IMAGE_PNG,
	gif: MIME_TYPE_IMAGE_GIF,
	webp: MIME_TYPE_IMAGE_WEBP
};

export function resolveMimeTypeByExtension(extension: string): string {
	const normalizedExtension = extension.trim().toLowerCase();

	return EXTENSION_CONTENT_TYPE[normalizedExtension] ?? MIME_TYPE_OCTET_STREAM;
}

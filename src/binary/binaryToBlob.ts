import {
	MIME_TYPE_DOCX,
	MIME_TYPE_IMAGE_GIF,
	MIME_TYPE_IMAGE_JPEG,
	MIME_TYPE_IMAGE_PNG,
	MIME_TYPE_IMAGE_TIFF,
	MIME_TYPE_IMAGE_WEBP,
	MIME_TYPE_MSWORD,
	MIME_TYPE_OCTET_STREAM,
	MIME_TYPE_PDF,
	MIME_TYPE_PPT,
	MIME_TYPE_PPTX,
	MIME_TYPE_XLS,
	MIME_TYPE_XLSX,
	MIME_TYPE_XML,
	MIME_TYPE_ZIP
} from "../file/mimeTypeConstants";
import { hasSignatureBytes } from "../file/signature/hasSignatureBytes";

import { BASE64_ENCODED_BLOCK_CHARACTERS, BASE64_PADDING } from "./base64Constants";

const BASE64_DATA_URL_PATTERN = /^data:([^,]*);base64,([\s\S]*)$/i;
const BASE64_HEADER_SCAN_CHARACTERS = 128;
const XML_HEADER_SCAN_CHARACTERS = 16;
// Здесь распознаётся только прежний короткий prefix, без усиления проверки формата.
const PDF_HEADER_PREFIX = [0x25, 0x50, 0x44, 0x46];
const JPEG_HEADER_PREFIX = [0xff, 0xd8, 0xff];
const PNG_HEADER_PREFIX = [0x89, 0x50, 0x4e, 0x47];
const GIF_HEADER_PREFIX = [0x47, 0x49, 0x46];
const WEBP_HEADER_PREFIX = [0x52, 0x49, 0x46, 0x46];
const ZIP_HEADER_PREFIX = [0x50, 0x4b];

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
	bmp: "image/bmp",
	csv: "text/csv",
	doc: MIME_TYPE_MSWORD,
	docx: MIME_TYPE_DOCX,
	gif: MIME_TYPE_IMAGE_GIF,
	jpeg: MIME_TYPE_IMAGE_JPEG,
	jpg: MIME_TYPE_IMAGE_JPEG,
	json: "application/json",
	pdf: MIME_TYPE_PDF,
	png: MIME_TYPE_IMAGE_PNG,
	ppt: MIME_TYPE_PPT,
	pptx: MIME_TYPE_PPTX,
	svg: "image/svg+xml",
	tif: MIME_TYPE_IMAGE_TIFF,
	tiff: MIME_TYPE_IMAGE_TIFF,
	txt: "text/plain",
	webp: MIME_TYPE_IMAGE_WEBP,
	xls: MIME_TYPE_XLS,
	xlsx: MIME_TYPE_XLSX,
	xml: MIME_TYPE_XML,
	zip: MIME_TYPE_ZIP
};

const normalizeBase64 = (value: string): string => {
	const normalized = value.replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
	const paddingRest = normalized.length % BASE64_ENCODED_BLOCK_CHARACTERS;

	if (paddingRest === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
		throw new Error("Некорректный формат base64");
	}

	return paddingRest === 0 ? normalized : `${normalized}${BASE64_PADDING.repeat(BASE64_ENCODED_BLOCK_CHARACTERS - paddingRest)}`;
};

const getBase64RawPayload = (binaryData: string): { data: string; mimeType: string | null } => {
	const dataUrlMatch = binaryData.match(BASE64_DATA_URL_PATTERN);

	if (!dataUrlMatch) {
		return { data: binaryData, mimeType: null };
	}

	const [, rawMimeType, rawData] = dataUrlMatch;
	const mimeType = rawMimeType.split(";")[0].trim();

	return {
		data: rawData,
		mimeType: mimeType || null
	};
};

const getBase64Payload = (binaryData: string): { data: string; mimeType: string | null } => {
	const payload = getBase64RawPayload(binaryData);

	return {
		data: normalizeBase64(payload.data),
		mimeType: payload.mimeType
	};
};

const getDataUrlMimeType = (binaryData: string): string | null => {
	const dataUrlMatch = binaryData.match(BASE64_DATA_URL_PATTERN);

	if (!dataUrlMatch) {
		return null;
	}

	const mimeType = dataUrlMatch[1].split(";")[0].trim();

	return mimeType || null;
};

const decodeBase64ToBytes = (binaryData: string): Uint8Array => {
	const { data } = getBase64Payload(binaryData);
	const binaryString = atob(data);
	const byteArray = new Uint8Array(binaryString.length);

	for (let index = 0; index < binaryString.length; index++) {
		byteArray[index] = binaryString.charCodeAt(index);
	}

	return byteArray;
};

const binaryStringToBytes = (binaryData: string): Uint8Array => {
	const byteArray = new Uint8Array(binaryData.length);

	for (let index = 0; index < binaryData.length; index++) {
		byteArray[index] = binaryData.charCodeAt(index);
	}

	return byteArray;
};

const copyBytesToArrayBuffer = (byteArray: Uint8Array): ArrayBuffer => {
	const buffer = new ArrayBuffer(byteArray.byteLength);
	const view = new Uint8Array(buffer);

	view.set(byteArray);

	return buffer;
};

const decodeHeaderFromBase64 = (binaryData: string): string | null => {
	try {
		const { data } = getBase64RawPayload(binaryData);
		const headerData = data.slice(0, BASE64_HEADER_SCAN_CHARACTERS);
		const binaryString = atob(normalizeBase64(headerData));

		return binaryString;
	} catch {
		return null;
	}
};

const detectMimeTypeBySignature = (binaryData: string): string | null => {
	const header = decodeHeaderFromBase64(binaryData);

	if (!header) {
		return null;
	}

	const bytes = new Uint8Array(header.length);

	for (let index = 0; index < header.length; index++) {
		bytes[index] = header.charCodeAt(index);
	}

	if (hasSignatureBytes(bytes, PDF_HEADER_PREFIX)) {
		return MIME_TYPE_PDF;
	}

	if (hasSignatureBytes(bytes, JPEG_HEADER_PREFIX)) {
		return MIME_TYPE_IMAGE_JPEG;
	}

	if (hasSignatureBytes(bytes, PNG_HEADER_PREFIX)) {
		return MIME_TYPE_IMAGE_PNG;
	}

	if (hasSignatureBytes(bytes, GIF_HEADER_PREFIX)) {
		return MIME_TYPE_IMAGE_GIF;
	}

	if (hasSignatureBytes(bytes, WEBP_HEADER_PREFIX)) {
		return MIME_TYPE_IMAGE_WEBP;
	}

	if (hasSignatureBytes(bytes, ZIP_HEADER_PREFIX)) {
		return MIME_TYPE_ZIP;
	}

	const textHeader = header
		.replace(/^\uFEFF/, "")
		.trimStart()
		.slice(0, XML_HEADER_SCAN_CHARACTERS);

	if (textHeader.startsWith("<?xml") || textHeader.startsWith("<")) {
		return MIME_TYPE_XML;
	}

	return null;
};

/**
 * Преобразует base64 или бинарную строку в Blob.
 *
 * Data URL с префиксом `data:*;base64,` поддерживается, сам URL здесь не создаётся.
 */
export const binaryToBlob = (binaryData: string, mimeType: string = MIME_TYPE_OCTET_STREAM, isBase64 = true): Blob => {
	if (!binaryData) {
		throw new Error("Не переданы бинарные данные");
	}

	try {
		const byteArray = isBase64 ? decodeBase64ToBytes(binaryData) : binaryStringToBytes(binaryData);

		if (byteArray.length === 0) {
			throw new Error("После преобразования не осталось данных");
		}

		return new Blob([copyBytesToArrayBuffer(byteArray)], { type: mimeType.trim() || MIME_TYPE_OCTET_STREAM });
	} catch (error) {
		if (error instanceof Error) {
			throw error;
		}
		throw new Error("Некорректный формат бинарных данных");
	}
};

/**
 * Определяет MIME-тип по имени файла, data URL или сигнатуре base64-данных.
 *
 * Если определить тип не удалось, используется PDF: большинство документов в этом контуре приходят именно так.
 */
export const detectMimeType = (fileName?: string, binaryData?: string): string => {
	if (fileName) {
		const extension = fileName.toLowerCase().split(".").pop();

		if (extension && MIME_TYPE_BY_EXTENSION[extension]) {
			return MIME_TYPE_BY_EXTENSION[extension];
		}
	}

	if (binaryData) {
		const dataUrlMimeType = getDataUrlMimeType(binaryData);

		if (dataUrlMimeType) {
			return dataUrlMimeType;
		}

		const signatureMimeType = detectMimeTypeBySignature(binaryData);

		if (signatureMimeType) {
			return signatureMimeType;
		}
	}

	return MIME_TYPE_PDF;
};

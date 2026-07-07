const DEFAULT_BLOB_MIME_TYPE = "application/octet-stream";
const DEFAULT_DOCUMENT_MIME_TYPE = "application/pdf";
const BASE64_DATA_URL_PATTERN = /^data:([^,]*);base64,([\s\S]*)$/i;

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
	bmp: "image/bmp",
	csv: "text/csv",
	doc: "application/msword",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	gif: "image/gif",
	jpeg: "image/jpeg",
	jpg: "image/jpeg",
	json: "application/json",
	pdf: "application/pdf",
	png: "image/png",
	ppt: "application/vnd.ms-powerpoint",
	pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	svg: "image/svg+xml",
	tif: "image/tiff",
	tiff: "image/tiff",
	txt: "text/plain",
	webp: "image/webp",
	xls: "application/vnd.ms-excel",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	xml: "application/xml",
	zip: "application/zip"
};

const normalizeBase64 = (value: string): string => {
	const normalized = value.replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
	const paddingRest = normalized.length % 4;

	if (paddingRest === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
		throw new Error("Некорректный формат base64");
	}

	return paddingRest === 0 ? normalized : `${normalized}${"=".repeat(4 - paddingRest)}`;
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
		const headerData = data.slice(0, 128);
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

	if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
		return "application/pdf";
	}

	if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
		return "image/jpeg";
	}

	if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
		return "image/png";
	}

	if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
		return "image/gif";
	}

	if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
		return "image/webp";
	}

	if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
		return "application/zip";
	}

	const textHeader = header
		.replace(/^\uFEFF/, "")
		.trimStart()
		.slice(0, 16);

	if (textHeader.startsWith("<?xml") || textHeader.startsWith("<")) {
		return "application/xml";
	}

	return null;
};

/**
 * Преобразует base64 или бинарную строку в Blob.
 *
 * Data URL с префиксом `data:*;base64,` поддерживается, сам URL здесь не создаётся.
 */
export const binaryToBlob = (binaryData: string, mimeType: string = DEFAULT_BLOB_MIME_TYPE, isBase64 = true): Blob => {
	if (!binaryData) {
		throw new Error("Не переданы бинарные данные");
	}

	try {
		const byteArray = isBase64 ? decodeBase64ToBytes(binaryData) : binaryStringToBytes(binaryData);

		if (byteArray.length === 0) {
			throw new Error("После преобразования не осталось данных");
		}

		return new Blob([copyBytesToArrayBuffer(byteArray)], { type: mimeType.trim() || DEFAULT_BLOB_MIME_TYPE });
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

	return DEFAULT_DOCUMENT_MIME_TYPE;
};

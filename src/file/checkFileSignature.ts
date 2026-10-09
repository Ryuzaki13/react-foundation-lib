import { type FileSignatureCheckOptions, type FileSignatureCheckResult } from "./fileSignatureTypes";
import { checkArchiveSignature } from "./signature/checkArchiveSignature";
import { checkPdfSignature } from "./signature/checkPdfSignature";
import { hasSignatureBytes, isTruncatedSignature } from "./signature/hasSignatureBytes";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PSD_SIGNATURE = [0x38, 0x42, 0x50, 0x53];
const RTF_SIGNATURE = [0x7b, 0x5c, 0x72, 0x74, 0x66, 0x31];

function checkJpegSignature(bytes: Uint8Array): FileSignatureCheckResult {
	if (bytes[0] !== 0xff) return "mismatch";
	let offset = 1;
	// T.81 допускает FF fill перед marker. Длинный prefix не превращаем в scan файла.
	while (offset < Math.min(bytes.length, 32) && bytes[offset] === 0xff) offset += 1;
	if (offset === 32 && bytes.length > offset) return "unsupported";
	return bytes[offset] === 0xd8 ? "match" : "mismatch";
}

function checkBitmapSignature(bytes: Uint8Array): FileSignatureCheckResult {
	if (isTruncatedSignature(bytes, [0x42, 0x4d])) return "mismatch";
	// OS/2/DIB и неизвестные альтернативы не запрещаем по Windows BM header.
	if (!hasSignatureBytes(bytes, [0x42, 0x4d])) return "unsupported";
	if (bytes.length < 14) return "mismatch";
	return hasSignatureBytes(bytes, [0, 0, 0, 0], 6) ? "match" : "mismatch";
}

function checkPhotoshopSignature(bytes: Uint8Array): FileSignatureCheckResult {
	if (!hasSignatureBytes(bytes, PSD_SIGNATURE)) return "mismatch";
	if (bytes.length < 6) return "mismatch";
	// PSB=2 и неизвестные версии имеют общее семейство, но не подтверждают PSD=1.
	if (bytes[4] !== 0 || bytes[5] !== 1) return "unsupported";
	return hasSignatureBytes(bytes, [0, 0, 0, 0, 0, 0], 6) ? "match" : "mismatch";
}

function checkRtfSignature(bytes: Uint8Array): FileSignatureCheckResult {
	if (isTruncatedSignature(bytes, RTF_SIGNATURE)) return "mismatch";
	if (!hasSignatureBytes(bytes, [0x7b, 0x5c, 0x72, 0x74, 0x66])) return "unsupported";
	if (!hasSignatureBytes(bytes, RTF_SIGNATURE) || bytes.length < 7) return "mismatch";
	const delimiter = bytes[6];
	// Полный control word не совпадает с \rtf10 или \rtf1abc.
	return (delimiter >= 0x30 && delimiter <= 0x39) || (delimiter >= 0x41 && delimiter <= 0x5a) || (delimiter >= 0x61 && delimiter <= 0x7a)
		? "mismatch"
		: "match";
}

/**
 * Частичная pure-проверка fixed headers: нет FileReader, Node API, декодирования,
 * распаковки или чтения всего файла. Любой match относится только к header.
 * Общий ZIP/OLE marker не подтверждает Office/ODF/XFL; allowlist принадлежит caller.
 */
export function checkFileSignature({ extension, bytes }: FileSignatureCheckOptions): FileSignatureCheckResult {
	const normalizedExtension = extension.trim().toLowerCase();
	switch (normalizedExtension) {
		case "png":
			return hasSignatureBytes(bytes, PNG_SIGNATURE) ? "match" : "mismatch";
		case "jpg":
		case "jpeg":
			return checkJpegSignature(bytes);
		case "bmp":
			return checkBitmapSignature(bytes);
		case "psd":
			return checkPhotoshopSignature(bytes);
		case "rtf":
			return checkRtfSignature(bytes);
		case "rar":
		case "zip":
		case "7z":
			return checkArchiveSignature(normalizedExtension, bytes);
		case "pdf":
			return checkPdfSignature(bytes);
		default:
			return "unsupported";
	}
}

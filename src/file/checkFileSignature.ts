import { FILE_SIGNATURE_EXTENSION, FILE_SIGNATURE_RESULT } from "./fileSignatureConstants";
import { type FileSignatureCheckOptions, type FileSignatureCheckResult } from "./fileSignatureTypes";
import { checkArchiveSignature } from "./signature/checkArchiveSignature";
import { checkPdfSignature } from "./signature/checkPdfSignature";
import { hasSignatureBytes, isTruncatedSignature } from "./signature/hasSignatureBytes";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MARKER_PREFIX = 0xff;
const JPEG_START_OF_IMAGE_MARKER = 0xd8;
// Ограничение работы checker, а не максимальная длина fill bytes формата JPEG.
const JPEG_MARKER_SCAN_BYTES = 32;
const BITMAP_SIGNATURE = [0x42, 0x4d];
const BITMAP_FILE_HEADER_BYTES = 14;
const BITMAP_RESERVED_OFFSET = 6;
const BITMAP_RESERVED_BYTES = [0, 0, 0, 0];
const PSD_SIGNATURE = [0x38, 0x42, 0x50, 0x53];
const PSD_SUPPORTED_VERSION = [0, 1];
const PSD_RESERVED_BYTES = [0, 0, 0, 0, 0, 0];
const RTF_FAMILY = [0x7b, 0x5c, 0x72, 0x74, 0x66];
const RTF_SIGNATURE = [0x7b, 0x5c, 0x72, 0x74, 0x66, 0x31];
// Цифра или буква продолжает control word вместо завершения версии rtf1.
const RTF_CONTROL_WORD_RANGES = {
	digit: [0x30, 0x39],
	uppercase: [0x41, 0x5a],
	lowercase: [0x61, 0x7a]
} as const;

function checkJpegSignature(bytes: Uint8Array): FileSignatureCheckResult {
	if (bytes[0] !== JPEG_MARKER_PREFIX) return FILE_SIGNATURE_RESULT.MISMATCH;
	let offset = 1;
	// T.81 допускает FF fill перед marker. Длинный prefix не превращаем в scan файла.
	while (offset < Math.min(bytes.length, JPEG_MARKER_SCAN_BYTES) && bytes[offset] === JPEG_MARKER_PREFIX) offset += 1;
	if (offset === JPEG_MARKER_SCAN_BYTES && bytes.length > offset) return FILE_SIGNATURE_RESULT.UNSUPPORTED;
	return bytes[offset] === JPEG_START_OF_IMAGE_MARKER ? FILE_SIGNATURE_RESULT.MATCH : FILE_SIGNATURE_RESULT.MISMATCH;
}

function checkBitmapSignature(bytes: Uint8Array): FileSignatureCheckResult {
	if (isTruncatedSignature(bytes, BITMAP_SIGNATURE)) return FILE_SIGNATURE_RESULT.MISMATCH;
	// OS/2/DIB и неизвестные альтернативы не запрещаем по Windows BM header.
	if (!hasSignatureBytes(bytes, BITMAP_SIGNATURE)) return FILE_SIGNATURE_RESULT.UNSUPPORTED;
	if (bytes.length < BITMAP_FILE_HEADER_BYTES) return FILE_SIGNATURE_RESULT.MISMATCH;
	return hasSignatureBytes(bytes, BITMAP_RESERVED_BYTES, BITMAP_RESERVED_OFFSET)
		? FILE_SIGNATURE_RESULT.MATCH
		: FILE_SIGNATURE_RESULT.MISMATCH;
}

function checkPhotoshopSignature(bytes: Uint8Array): FileSignatureCheckResult {
	if (!hasSignatureBytes(bytes, PSD_SIGNATURE)) return FILE_SIGNATURE_RESULT.MISMATCH;
	const reservedOffset = PSD_SIGNATURE.length + PSD_SUPPORTED_VERSION.length;
	if (bytes.length < reservedOffset) return FILE_SIGNATURE_RESULT.MISMATCH;
	// PSB=2 и неизвестные версии имеют общее семейство, но не подтверждают PSD=1.
	if (!hasSignatureBytes(bytes, PSD_SUPPORTED_VERSION, PSD_SIGNATURE.length)) return FILE_SIGNATURE_RESULT.UNSUPPORTED;
	return hasSignatureBytes(bytes, PSD_RESERVED_BYTES, reservedOffset) ? FILE_SIGNATURE_RESULT.MATCH : FILE_SIGNATURE_RESULT.MISMATCH;
}

function checkRtfSignature(bytes: Uint8Array): FileSignatureCheckResult {
	if (isTruncatedSignature(bytes, RTF_SIGNATURE)) return FILE_SIGNATURE_RESULT.MISMATCH;
	if (!hasSignatureBytes(bytes, RTF_FAMILY)) return FILE_SIGNATURE_RESULT.UNSUPPORTED;
	if (!hasSignatureBytes(bytes, RTF_SIGNATURE) || bytes.length <= RTF_SIGNATURE.length) return FILE_SIGNATURE_RESULT.MISMATCH;
	const delimiter = bytes[RTF_SIGNATURE.length];
	// Полный control word не совпадает с \rtf10 или \rtf1abc.
	return (delimiter >= RTF_CONTROL_WORD_RANGES.digit[0] && delimiter <= RTF_CONTROL_WORD_RANGES.digit[1]) ||
		(delimiter >= RTF_CONTROL_WORD_RANGES.uppercase[0] && delimiter <= RTF_CONTROL_WORD_RANGES.uppercase[1]) ||
		(delimiter >= RTF_CONTROL_WORD_RANGES.lowercase[0] && delimiter <= RTF_CONTROL_WORD_RANGES.lowercase[1])
		? FILE_SIGNATURE_RESULT.MISMATCH
		: FILE_SIGNATURE_RESULT.MATCH;
}

/**
 * Частичная pure-проверка fixed headers: нет FileReader, Node API, декодирования,
 * распаковки или чтения всего файла. Любой match относится только к header.
 * Общий ZIP/OLE marker не подтверждает Office/ODF/XFL; allowlist принадлежит caller.
 */
export function checkFileSignature({ extension, bytes }: FileSignatureCheckOptions): FileSignatureCheckResult {
	const normalizedExtension = extension.trim().toLowerCase();
	switch (normalizedExtension) {
		case FILE_SIGNATURE_EXTENSION.PNG:
			return hasSignatureBytes(bytes, PNG_SIGNATURE) ? FILE_SIGNATURE_RESULT.MATCH : FILE_SIGNATURE_RESULT.MISMATCH;
		case FILE_SIGNATURE_EXTENSION.JPG:
		case FILE_SIGNATURE_EXTENSION.JPEG:
			return checkJpegSignature(bytes);
		case FILE_SIGNATURE_EXTENSION.BMP:
			return checkBitmapSignature(bytes);
		case FILE_SIGNATURE_EXTENSION.PSD:
			return checkPhotoshopSignature(bytes);
		case FILE_SIGNATURE_EXTENSION.RTF:
			return checkRtfSignature(bytes);
		case FILE_SIGNATURE_EXTENSION.RAR:
		case FILE_SIGNATURE_EXTENSION.ZIP:
		case FILE_SIGNATURE_EXTENSION.SEVEN_ZIP:
			return checkArchiveSignature(normalizedExtension, bytes);
		case FILE_SIGNATURE_EXTENSION.PDF:
			return checkPdfSignature(bytes);
		default:
			return FILE_SIGNATURE_RESULT.UNSUPPORTED;
	}
}

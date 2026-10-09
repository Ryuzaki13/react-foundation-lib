import { type FileSignatureCheckResult } from "../fileSignatureTypes";

import { hasSignatureBytes, isTruncatedSignature } from "./hasSignatureBytes";

const PDF_FAMILY = [0x25, 0x50, 0x44, 0x46];
const PDF_SCAN_LIMIT = 1024;

/**
 * Adobe документирует header с ненулевым offset. Проверяем только первые 1024
 * bytes без копии/полного scan; альтернативный PS header и неизвестные версии
 * не объявляем mismatch. Версия в header не доказывает структуру документа.
 */
export function checkPdfSignature(bytes: Uint8Array): FileSignatureCheckResult {
	if (isTruncatedSignature(bytes, PDF_FAMILY)) return "mismatch";
	const limit = Math.min(bytes.length, PDF_SCAN_LIMIT);
	let malformedHeader = false;
	let unknownRepresentation = false;

	for (let offset = 0; offset + PDF_FAMILY.length <= limit; offset += 1) {
		if (!hasSignatureBytes(bytes, PDF_FAMILY, offset)) continue;
		if (offset + 8 > limit) {
			// EOF доказывает усечение; граница scan не является концом файла.
			if (offset + 8 > bytes.length) malformedHeader = true;
			else unknownRepresentation = true;
			continue;
		}
		const major = bytes[offset + 5];
		const minor = bytes[offset + 7];
		if (bytes[offset + 4] !== 0x2d || bytes[offset + 6] !== 0x2e || major < 0x30 || major > 0x39 || minor < 0x30 || minor > 0x39) {
			malformedHeader = true;
			continue;
		}
		if ((major === 0x31 && minor <= 0x37) || (major === 0x32 && minor === 0x30)) return "match";
		unknownRepresentation = true;
	}

	return unknownRepresentation ? "unsupported" : malformedHeader ? "mismatch" : "unsupported";
}

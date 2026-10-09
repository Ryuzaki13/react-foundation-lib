import { FILE_SIGNATURE_RESULT } from "../fileSignatureConstants";
import { type FileSignatureCheckResult } from "../fileSignatureTypes";

import { hasSignatureBytes, isTruncatedSignature } from "./hasSignatureBytes";

const PDF_FAMILY = [0x25, 0x50, 0x44, 0x46];
const PDF_SCAN_LIMIT = 1024;
// Позиции относятся к локальному %PDF-x.y header, а не ко всему документу.
const PDF_HEADER_BYTES = 8;
const PDF_FAMILY_SEPARATOR_OFFSET = 4;
const PDF_FAMILY_SEPARATOR = 0x2d;
const PDF_MAJOR_VERSION_OFFSET = 5;
const PDF_VERSION_SEPARATOR_OFFSET = 6;
const PDF_VERSION_SEPARATOR = 0x2e;
const PDF_MINOR_VERSION_OFFSET = 7;
const PDF_VERSION_DIGIT_FIRST = 0x30;
const PDF_VERSION_DIGIT_LAST = 0x39;
const PDF_VERSION_1_MAJOR = 0x31;
const PDF_VERSION_1_MINOR_LAST = 0x37;
const PDF_VERSION_2_MAJOR = 0x32;
const PDF_VERSION_2_MINOR = 0x30;

/**
 * Adobe документирует header с ненулевым offset. Проверяем только первые 1024
 * bytes без копии/полного scan; альтернативный PS header и неизвестные версии
 * не объявляем mismatch. Версия в header не доказывает структуру документа.
 */
export function checkPdfSignature(bytes: Uint8Array): FileSignatureCheckResult {
	if (isTruncatedSignature(bytes, PDF_FAMILY)) return FILE_SIGNATURE_RESULT.MISMATCH;
	const limit = Math.min(bytes.length, PDF_SCAN_LIMIT);
	let malformedHeader = false;
	let unknownRepresentation = false;

	for (let offset = 0; offset + PDF_FAMILY.length <= limit; offset += 1) {
		if (!hasSignatureBytes(bytes, PDF_FAMILY, offset)) continue;
		if (offset + PDF_HEADER_BYTES > limit) {
			// EOF доказывает усечение; граница scan не является концом файла.
			if (offset + PDF_HEADER_BYTES > bytes.length) malformedHeader = true;
			else unknownRepresentation = true;
			continue;
		}
		const major = bytes[offset + PDF_MAJOR_VERSION_OFFSET];
		const minor = bytes[offset + PDF_MINOR_VERSION_OFFSET];
		if (
			bytes[offset + PDF_FAMILY_SEPARATOR_OFFSET] !== PDF_FAMILY_SEPARATOR ||
			bytes[offset + PDF_VERSION_SEPARATOR_OFFSET] !== PDF_VERSION_SEPARATOR ||
			major < PDF_VERSION_DIGIT_FIRST ||
			major > PDF_VERSION_DIGIT_LAST ||
			minor < PDF_VERSION_DIGIT_FIRST ||
			minor > PDF_VERSION_DIGIT_LAST
		) {
			malformedHeader = true;
			continue;
		}
		if (
			(major === PDF_VERSION_1_MAJOR && minor <= PDF_VERSION_1_MINOR_LAST) ||
			(major === PDF_VERSION_2_MAJOR && minor === PDF_VERSION_2_MINOR)
		)
			return FILE_SIGNATURE_RESULT.MATCH;
		unknownRepresentation = true;
	}

	return unknownRepresentation
		? FILE_SIGNATURE_RESULT.UNSUPPORTED
		: malformedHeader
			? FILE_SIGNATURE_RESULT.MISMATCH
			: FILE_SIGNATURE_RESULT.UNSUPPORTED;
}

import { type FileSignatureCheckResult } from "../fileSignatureTypes";

import { hasSignatureBytes, isTruncatedSignature } from "./hasSignatureBytes";

const RAR_FAMILY = [0x52, 0x61, 0x72, 0x21];
const SEVEN_ZIP_SIGNATURE = [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c];

/**
 * RARLAB marker распознаёт RAR4/5 без main/encryption header. Не ищем marker
 * внутри SFX: отсутствие начального семейства не доказывает неверный архив.
 */
function checkRarSignature(bytes: Uint8Array): FileSignatureCheckResult {
	if (isTruncatedSignature(bytes, RAR_FAMILY)) return "mismatch";
	if (!hasSignatureBytes(bytes, RAR_FAMILY)) return "unsupported";
	if (bytes.length < 7 || bytes[4] !== 0x1a || bytes[5] !== 0x07) return "mismatch";
	if (bytes[6] === 0) return "match";
	if (bytes[6] !== 1) return "unsupported";
	return bytes.length >= 8 && bytes[7] === 0 ? "match" : "mismatch";
}

/** PKWARE fixed header не проверяет payload, central directory, CRC или parts. */
function checkZipSignature(bytes: Uint8Array): FileSignatureCheckResult {
	if (isTruncatedSignature(bytes, [0x50, 0x4b])) return "mismatch";
	if (!hasSignatureBytes(bytes, [0x50, 0x4b])) return "unsupported";
	if (bytes.length < 3) return "mismatch";
	if (bytes[2] === 0x03) return bytes.length >= 30 && bytes[3] === 0x04 ? "match" : "mismatch";
	if (bytes[2] === 0x05) return bytes.length >= 22 && bytes[3] === 0x06 ? "match" : "mismatch";
	// Split/spanning, SFX и прочие records не подтверждаем как обычный start header.
	return "unsupported";
}

/** SignatureHeader 7-Zip занимает 32 bytes; NextHeader и CRC здесь не проверяются. */
function checkSevenZipSignature(bytes: Uint8Array): FileSignatureCheckResult {
	if (isTruncatedSignature(bytes, SEVEN_ZIP_SIGNATURE)) return "mismatch";
	if (!hasSignatureBytes(bytes, SEVEN_ZIP_SIGNATURE)) {
		return hasSignatureBytes(bytes, [0x37, 0x7a]) ? "mismatch" : "unsupported";
	}
	if (bytes.length < 8) return "mismatch";
	// У официального reader major=0; minor не является запретом новой версии.
	if (bytes[6] !== 0) return "unsupported";
	return bytes.length >= 32 ? "match" : "mismatch";
}

export function checkArchiveSignature(extension: "rar" | "zip" | "7z", bytes: Uint8Array): FileSignatureCheckResult {
	if (extension === "rar") return checkRarSignature(bytes);
	if (extension === "zip") return checkZipSignature(bytes);
	return checkSevenZipSignature(bytes);
}

import { FILE_SIGNATURE_EXTENSION, FILE_SIGNATURE_RESULT } from "../fileSignatureConstants";
import { type ArchiveFileSignatureExtension, type FileSignatureCheckResult } from "../fileSignatureTypes";

import { hasSignatureBytes, isTruncatedSignature } from "./hasSignatureBytes";

const RAR_FAMILY = [0x52, 0x61, 0x72, 0x21];
const RAR_MARKER_SUFFIX = [0x1a, 0x07];
const RAR4_VERSION = 0;
const RAR5_VERSION = 1;
const RAR5_MARKER_END = 0;
const ZIP_FAMILY = [0x50, 0x4b];
const ZIP_LOCAL_FILE_MARKER = [0x03, 0x04];
const ZIP_END_OF_CENTRAL_DIRECTORY_MARKER = [0x05, 0x06];
const ZIP_LOCAL_FILE_HEADER_BYTES = 30;
const ZIP_END_OF_CENTRAL_DIRECTORY_BYTES = 22;
const SEVEN_ZIP_FAMILY = [0x37, 0x7a];
const SEVEN_ZIP_SIGNATURE = [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c];
const SEVEN_ZIP_VERSION_BYTES = 2;
const SEVEN_ZIP_SUPPORTED_MAJOR_VERSION = 0;
const SEVEN_ZIP_SIGNATURE_HEADER_BYTES = 32;

/**
 * RARLAB marker распознаёт RAR4/5 без main/encryption header. Не ищем marker
 * внутри SFX: отсутствие начального семейства не доказывает неверный архив.
 */
function checkRarSignature(bytes: Uint8Array): FileSignatureCheckResult {
	if (isTruncatedSignature(bytes, RAR_FAMILY)) return FILE_SIGNATURE_RESULT.MISMATCH;
	if (!hasSignatureBytes(bytes, RAR_FAMILY)) return FILE_SIGNATURE_RESULT.UNSUPPORTED;
	const versionOffset = RAR_FAMILY.length + RAR_MARKER_SUFFIX.length;
	if (bytes.length <= versionOffset || !hasSignatureBytes(bytes, RAR_MARKER_SUFFIX, RAR_FAMILY.length))
		return FILE_SIGNATURE_RESULT.MISMATCH;
	if (bytes[versionOffset] === RAR4_VERSION) return FILE_SIGNATURE_RESULT.MATCH;
	if (bytes[versionOffset] !== RAR5_VERSION) return FILE_SIGNATURE_RESULT.UNSUPPORTED;
	return bytes[versionOffset + 1] === RAR5_MARKER_END ? FILE_SIGNATURE_RESULT.MATCH : FILE_SIGNATURE_RESULT.MISMATCH;
}

/** PKWARE fixed header не проверяет payload, central directory, CRC или parts. */
function checkZipSignature(bytes: Uint8Array): FileSignatureCheckResult {
	if (isTruncatedSignature(bytes, ZIP_FAMILY)) return FILE_SIGNATURE_RESULT.MISMATCH;
	if (!hasSignatureBytes(bytes, ZIP_FAMILY)) return FILE_SIGNATURE_RESULT.UNSUPPORTED;
	const recordOffset = ZIP_FAMILY.length;
	if (bytes.length <= recordOffset) return FILE_SIGNATURE_RESULT.MISMATCH;
	if (bytes[recordOffset] === ZIP_LOCAL_FILE_MARKER[0]) {
		return bytes.length >= ZIP_LOCAL_FILE_HEADER_BYTES && hasSignatureBytes(bytes, ZIP_LOCAL_FILE_MARKER, recordOffset)
			? FILE_SIGNATURE_RESULT.MATCH
			: FILE_SIGNATURE_RESULT.MISMATCH;
	}
	if (bytes[recordOffset] === ZIP_END_OF_CENTRAL_DIRECTORY_MARKER[0]) {
		return bytes.length >= ZIP_END_OF_CENTRAL_DIRECTORY_BYTES &&
			hasSignatureBytes(bytes, ZIP_END_OF_CENTRAL_DIRECTORY_MARKER, recordOffset)
			? FILE_SIGNATURE_RESULT.MATCH
			: FILE_SIGNATURE_RESULT.MISMATCH;
	}
	// Split/spanning, SFX и прочие records не подтверждаем как обычный start header.
	return FILE_SIGNATURE_RESULT.UNSUPPORTED;
}

/** SignatureHeader 7-Zip занимает 32 bytes; NextHeader и CRC здесь не проверяются. */
function checkSevenZipSignature(bytes: Uint8Array): FileSignatureCheckResult {
	if (isTruncatedSignature(bytes, SEVEN_ZIP_SIGNATURE)) return FILE_SIGNATURE_RESULT.MISMATCH;
	if (!hasSignatureBytes(bytes, SEVEN_ZIP_SIGNATURE)) {
		return hasSignatureBytes(bytes, SEVEN_ZIP_FAMILY) ? FILE_SIGNATURE_RESULT.MISMATCH : FILE_SIGNATURE_RESULT.UNSUPPORTED;
	}
	if (bytes.length < SEVEN_ZIP_SIGNATURE.length + SEVEN_ZIP_VERSION_BYTES) return FILE_SIGNATURE_RESULT.MISMATCH;
	// У официального reader major=0; minor не является запретом новой версии.
	if (bytes[SEVEN_ZIP_SIGNATURE.length] !== SEVEN_ZIP_SUPPORTED_MAJOR_VERSION) return FILE_SIGNATURE_RESULT.UNSUPPORTED;
	return bytes.length >= SEVEN_ZIP_SIGNATURE_HEADER_BYTES ? FILE_SIGNATURE_RESULT.MATCH : FILE_SIGNATURE_RESULT.MISMATCH;
}

export function checkArchiveSignature(extension: ArchiveFileSignatureExtension, bytes: Uint8Array): FileSignatureCheckResult {
	if (extension === FILE_SIGNATURE_EXTENSION.RAR) return checkRarSignature(bytes);
	if (extension === FILE_SIGNATURE_EXTENSION.ZIP) return checkZipSignature(bytes);
	return checkSevenZipSignature(bytes);
}

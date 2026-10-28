import { HEXADECIMAL_RADIX } from "./hexadecimalConstants";

// Позиции полей и фиксированные биты относятся к UUID v4, а не к случайным данным.
const UUID_BYTE_LENGTH = 16;
const UUID_BYTE_VALUE_COUNT = 256;
const UUID_VERSION_FIELD_INDEX = 6;
const UUID_VARIANT_FIELD_INDEX = 8;
const UUID_V4_VERSION_BITS = 0x40;
const UUID_RFC4122_VARIANT_BITS = 0x80;

/**
 * UUID v4 (RFC 4122)
 */
export function uuidv4(): string {
	if (crypto.randomUUID) {
		return crypto.randomUUID();
	}

	const bytes = new Uint8Array(UUID_BYTE_LENGTH);
	crypto.getRandomValues(bytes);

	// Версия 4
	bytes[UUID_VERSION_FIELD_INDEX] = (bytes[UUID_VERSION_FIELD_INDEX] & 0x0f) | UUID_V4_VERSION_BITS;
	// Вариант RFC 4122
	bytes[UUID_VARIANT_FIELD_INDEX] = (bytes[UUID_VARIANT_FIELD_INDEX] & 0x3f) | UUID_RFC4122_VARIANT_BITS;

	const hex = new Array<string>(UUID_BYTE_VALUE_COUNT);
	for (let i = 0; i < UUID_BYTE_VALUE_COUNT; i++) {
		hex[i] = (i + UUID_BYTE_VALUE_COUNT).toString(HEXADECIMAL_RADIX).slice(1);
	}

	return (
		hex[bytes[0]] +
		hex[bytes[1]] +
		hex[bytes[2]] +
		hex[bytes[3]] +
		"-" +
		hex[bytes[4]] +
		hex[bytes[5]] +
		"-" +
		hex[bytes[6]] +
		hex[bytes[7]] +
		"-" +
		hex[bytes[8]] +
		hex[bytes[9]] +
		"-" +
		hex[bytes[10]] +
		hex[bytes[11]] +
		hex[bytes[12]] +
		hex[bytes[13]] +
		hex[bytes[14]] +
		hex[bytes[15]]
	);
}

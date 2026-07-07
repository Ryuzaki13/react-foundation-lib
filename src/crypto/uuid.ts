/**
 * UUID v4 (RFC 4122)
 */
export function uuidv4(): string {
	if (crypto.randomUUID) {
		return crypto.randomUUID();
	}

	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);

	// Версия 4
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	// Вариант RFC 4122
	bytes[8] = (bytes[8] & 0x3f) | 0x80;

	const hex = new Array<string>(256);
	for (let i = 0; i < 256; i++) {
		hex[i] = (i + 0x100).toString(16).slice(1);
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

/** Читаем только переданный view: соседние bytes его backing buffer не участвуют. */
export function hasSignatureBytes(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
	if (offset + signature.length > bytes.length) return false;
	return signature.every((value, index) => bytes[offset + index] === value);
}

/** Точный оборванный prefix отличаем от неизвестного представления/SFX. */
export function isTruncatedSignature(bytes: Uint8Array, signature: readonly number[]): boolean {
	return bytes.length < signature.length && bytes.every((value, index) => value === signature[index]);
}

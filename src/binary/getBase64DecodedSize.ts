import { BASE64_DECODED_BLOCK_BYTES, BASE64_DOUBLE_PADDING, BASE64_ENCODED_BLOCK_CHARACTERS, BASE64_PADDING } from "./base64Constants";

const INVALID_BASE64_CHARACTER_PATTERN = /[^A-Za-z0-9+/=]/;

/**
 * Проверяет стандартную Base64-форму и считает байты без декодирования или создания Buffer/Blob.
 * Невалидный payload возвращает null, пустая строка — 0; допустимый размер определяет вызывающий контракт.
 * Data URL, whitespace, URL-safe алфавит и отсутствующий padding здесь не нормализуются.
 */
export function getBase64DecodedSize(value: string): number | null {
	if (value.length % BASE64_ENCODED_BLOCK_CHARACTERS !== 0 || INVALID_BASE64_CHARACTER_PATTERN.test(value)) return null;
	const paddingLength = value.endsWith(BASE64_DOUBLE_PADDING) ? 2 : value.endsWith(BASE64_PADDING) ? 1 : 0;
	const firstPaddingIndex = value.indexOf(BASE64_PADDING);
	if (firstPaddingIndex !== -1 && firstPaddingIndex !== value.length - paddingLength) return null;
	return Math.floor((value.length * BASE64_DECODED_BLOCK_BYTES) / BASE64_ENCODED_BLOCK_CHARACTERS) - paddingLength;
}

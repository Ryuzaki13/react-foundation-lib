import { HEXADECIMAL_RADIX } from "./hexadecimalConstants";

// Эти параметры закрепляют существующее детерминированное представление hash и ID.
const FNV1A_OFFSET_BASIS = 0x811c9dc5;
const HASH_STRING_RADIX = 36;
const HASH128_WORD_HEX_WIDTH = 8;
const HASH128_HEX_PADDING = "0";
const HASH128_INITIAL_SEED_1 = 0xdeadbeef;
const HASH128_INITIAL_SEED_2 = 0x41c6ce57;
const HASH128_INITIAL_SEED_3 = 0xc0decafe;
const HASH128_INITIAL_SEED_4 = 0x12345678;
const HASH128_CHARACTER_MULTIPLIER_1 = 2654435761;
const HASH128_CHARACTER_MULTIPLIER_2 = 1597334677;
const HASH128_CHARACTER_MULTIPLIER_3 = 2246822507;
const HASH128_CHARACTER_MULTIPLIER_4 = 3266489909;
const HASH128_FINAL_MULTIPLIER_1 = 597399067;
const HASH128_FINAL_MULTIPLIER_2 = 2869860233;
const HASH128_FINAL_MULTIPLIER_3 = 951274213;
const HASH128_FINAL_MULTIPLIER_4 = 2716044179;

export function hashString(input: string): string {
	let hash = FNV1A_OFFSET_BASIS;

	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);

		// FNV-1a 32-bit
		hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
	}

	// unsigned 32-bit -> compact string
	return (hash >>> 0).toString(HASH_STRING_RADIX);
}

function hashString128Base(input: string) {
	let h1 = HASH128_INITIAL_SEED_1 ^ input.length;
	let h2 = HASH128_INITIAL_SEED_2 ^ input.length;
	let h3 = HASH128_INITIAL_SEED_3 ^ input.length;
	let h4 = HASH128_INITIAL_SEED_4 ^ input.length;

	for (let i = 0; i < input.length; i++) {
		const ch = input.charCodeAt(i);

		h1 = Math.imul(h1 ^ ch, HASH128_CHARACTER_MULTIPLIER_1);
		h2 = Math.imul(h2 ^ ch, HASH128_CHARACTER_MULTIPLIER_2);
		h3 = Math.imul(h3 ^ ch, HASH128_CHARACTER_MULTIPLIER_3);
		h4 = Math.imul(h4 ^ ch, HASH128_CHARACTER_MULTIPLIER_4);
	}

	h1 = Math.imul(h3 ^ (h1 >>> 18), HASH128_FINAL_MULTIPLIER_1);
	h2 = Math.imul(h4 ^ (h2 >>> 22), HASH128_FINAL_MULTIPLIER_2);
	h3 = Math.imul(h1 ^ (h3 >>> 17), HASH128_FINAL_MULTIPLIER_3);
	h4 = Math.imul(h2 ^ (h4 >>> 19), HASH128_FINAL_MULTIPLIER_4);

	const p1 = (h1 ^ h2 ^ h3 ^ h4) >>> 0;
	const p2 = (h2 ^ h1) >>> 0;
	const p3 = (h3 ^ h1) >>> 0;
	const p4 = (h4 ^ h1) >>> 0;

	return [p1, p2, p3, p4];
}

export function hashString128(input: string): string {
	const p = hashString128Base(input);

	return (
		p[0].toString(HEXADECIMAL_RADIX).padStart(HASH128_WORD_HEX_WIDTH, HASH128_HEX_PADDING) +
		p[1].toString(HEXADECIMAL_RADIX).padStart(HASH128_WORD_HEX_WIDTH, HASH128_HEX_PADDING) +
		p[2].toString(HEXADECIMAL_RADIX).padStart(HASH128_WORD_HEX_WIDTH, HASH128_HEX_PADDING) +
		p[3].toString(HEXADECIMAL_RADIX).padStart(HASH128_WORD_HEX_WIDTH, HASH128_HEX_PADDING)
	);
}

function uint32ToBytes(value: number): number[] {
	return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function bytesToBase64Url(bytes: number[]): string {
	let binary = "";
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}

	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function hashString128Base64Url(input: string): string {
	const p = hashString128Base(input);

	return bytesToBase64Url([...uint32ToBytes(p[0]), ...uint32ToBytes(p[1]), ...uint32ToBytes(p[2]), ...uint32ToBytes(p[3])]);
}

export function stringToElementId(input: string, prefix = "row"): string {
	return `${prefix}-${hashString128Base64Url(input)}`;
}

export function hashString(input: string): string {
	let hash = 0x811c9dc5;

	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);

		// FNV-1a 32-bit
		hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
	}

	// unsigned 32-bit -> compact string
	return (hash >>> 0).toString(36);
}

function hashString128Base(input: string) {
	let h1 = 0xdeadbeef ^ input.length;
	let h2 = 0x41c6ce57 ^ input.length;
	let h3 = 0xc0decafe ^ input.length;
	let h4 = 0x12345678 ^ input.length;

	for (let i = 0; i < input.length; i++) {
		const ch = input.charCodeAt(i);

		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
		h3 = Math.imul(h3 ^ ch, 2246822507);
		h4 = Math.imul(h4 ^ ch, 3266489909);
	}

	h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
	h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
	h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
	h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);

	const p1 = (h1 ^ h2 ^ h3 ^ h4) >>> 0;
	const p2 = (h2 ^ h1) >>> 0;
	const p3 = (h3 ^ h1) >>> 0;
	const p4 = (h4 ^ h1) >>> 0;

	return [p1, p2, p3, p4];
}

export function hashString128(input: string): string {
	const p = hashString128Base(input);

	return (
		p[0].toString(16).padStart(8, "0") +
		p[1].toString(16).padStart(8, "0") +
		p[2].toString(16).padStart(8, "0") +
		p[3].toString(16).padStart(8, "0")
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

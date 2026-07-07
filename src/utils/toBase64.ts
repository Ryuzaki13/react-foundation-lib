export function toBase64(str: string): string {
	return btoa(new TextEncoder().encode(str).reduce((acc, byte) => acc + String.fromCharCode(byte), ""));
}

export function encodeBase64(str: string): string {
	return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))));
}

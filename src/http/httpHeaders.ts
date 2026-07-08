export type NoStoreHeadersInit = HeadersInit | undefined;

export function createNoStoreHeaders(init?: NoStoreHeadersInit): Headers {
	const headers = new Headers(init);

	headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
	headers.set("Pragma", "no-cache");
	headers.set("Expires", "0");

	return headers;
}

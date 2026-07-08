import { createNoStoreHeaders } from "./httpHeaders";

export type TextHttpResponseOptions = {
	readonly status: number;
	readonly text: string;
	readonly headers?: HeadersInit;
};

export function createTextHttpResponse({ status, text, headers }: TextHttpResponseOptions): Response {
	const responseHeaders = createNoStoreHeaders(headers);
	responseHeaders.set("Content-Type", "text/plain; charset=UTF-8");

	return new Response(text, {
		status,
		headers: responseHeaders
	});
}

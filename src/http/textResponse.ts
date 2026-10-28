import { MIME_TYPE_TEXT_PLAIN_UTF8 } from "../file/mimeTypeConstants";

import { createNoStoreHeaders } from "./httpHeaders";

export type TextHttpResponseOptions = {
	readonly status: number;
	readonly text: string;
	readonly headers?: HeadersInit;
};

export function createTextHttpResponse({ status, text, headers }: TextHttpResponseOptions): Response {
	const responseHeaders = createNoStoreHeaders(headers);
	responseHeaders.set("Content-Type", MIME_TYPE_TEXT_PLAIN_UTF8);

	return new Response(text, {
		status,
		headers: responseHeaders
	});
}

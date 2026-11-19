import { expect, it } from "vitest";

import { resolveMimeTypeByExtension } from "./mimeType";

it.each([
	[" MP4 ", "video/mp4"],
	["webm", "video/webm"],
	["MOV", "video/quicktime"]
])("определяет тип видео %s", (extension, expected) => {
	expect(resolveMimeTypeByExtension(extension)).toBe(expected);
});

import { describe, expect, it } from "vitest";

import { resolveHttpByteRange } from "./resolveHttpByteRange";

describe("один диапазон HTTP", () => {
	it.each([
		["bytes=0-0", { start: 0, end: 0 }],
		["Bytes=2-", { start: 2, end: 9 }],
		["bytes=8-9999999999999999999999", { start: 8, end: 9 }],
		["bytes=-4", { start: 6, end: 9 }],
		["bytes=-100", { start: 0, end: 9 }],
		["bytes=-0", "unsatisfiable"],
		["bytes=10-", "unsatisfiable"],
		["bytes=9999999999999999999999-", "unsatisfiable"],
		["bytes=5-3", null],
		["bytes=0-1,3-4", null],
		["items=0-2", null],
		["bytes=-", null],
		[null, null]
	] as const)("%s при размере 10", (header, range) => {
		expect(resolveHttpByteRange(header, 10)).toEqual(range);
	});

	it("обрабатывает пустое представление и отказывается от неточного размера", () => {
		expect(resolveHttpByteRange("bytes=-3", 0)).toBe("unsatisfiable");
		expect(resolveHttpByteRange("bytes=0-", 0)).toBe("unsatisfiable");
		expect(() => resolveHttpByteRange(null, -1)).toThrow(RangeError);
	});
});

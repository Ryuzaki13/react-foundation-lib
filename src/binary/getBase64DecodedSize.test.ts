import { describe, expect, it } from "vitest";

import { getBase64DecodedSize } from "./index";

describe("getBase64DecodedSize", () => {
	it.each([
		["", 0],
		["AA==", 1],
		["/w==", 1],
		["AAE=", 2],
		["+/8=", 2],
		["QUJD", 3],
		["+///", 3],
		["SGVsbG8=", 5],
		["AAECAwQFBgcICQ==", 10],
		["0J/RgNC40LLQtdGC", 12]
	] as const)("считает размер стандартного payload %s как %s байт", (value, size) => {
		expect(getBase64DecodedSize(value)).toBe(size);
	});

	it.each([
		"A",
		"AA",
		"AAA",
		"AAAAA",
		"AAAA=",
		"====",
		"A===",
		"=AAA",
		"AA=A",
		"AAAA===",
		"____",
		"----",
		"AA*+",
		"AAA ",
		"AAA\n",
		"AAA\r",
		"AA\r\n",
		"AA\tA",
		"ЖЖЖЖ",
		"data:text/plain;base64,QUJD"
	])("отклоняет неверную форму без нормализации: %j", (value) => {
		expect(getBase64DecodedSize(value)).toBeNull();
	});
});

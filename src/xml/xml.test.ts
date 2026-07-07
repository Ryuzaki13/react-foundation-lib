// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { buildXmlFields, getXmlTagText } from "./xml";

// MRMD example

const SOAP_ENVELOPE_ATTRIBUTES = [
	'xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"',
	'xmlns:urn="urn:sap-com:document:sap:rfc:functions"',
	'xmlns:i="http://www.w3.org/2001/XMLSchema-instance"',
	'xmlns:c="http://schemas.xmlsoap.org/soap/encoding/"',
	'xmlns:d="http://www.w3.org/2001/XMLSchema"'
].join(" ");

export function buildSoapEnvelope(functionName: string, body: string, functionAttributes = "") {
	return `<soapenv:Envelope ${SOAP_ENVELOPE_ATTRIBUTES}><soapenv:Header/><soapenv:Body><urn:${functionName}${functionAttributes}>${body}</urn:${functionName}></soapenv:Body></soapenv:Envelope>`;
}

describe("image api xml", () => {
	it("собирает компактный SOAP XML без переносов строк", () => {
		const xml = buildSoapEnvelope("TEST_FN", `<DATA>${buildXmlFields({ VALUE: "123" })}</DATA>`);

		expect(xml).toContain("<urn:TEST_FN><DATA><VALUE>123</VALUE></DATA></urn:TEST_FN>");
		expect(xml).not.toContain("\n");
	});

	it("экранирует специальные символы в значениях", () => {
		const xml = buildXmlFields({ VALUE: `a&b<c>d"e'f` });

		expect(xml).toBe("<VALUE>a&amp;b&lt;c&gt;d&quot;e&apos;f</VALUE>");
	});

	it("читает текст тега без лишних пробелов", () => {
		const xml = "<root><EX_MESSAGE>  Ошибка  </EX_MESSAGE></root>";

		expect(getXmlTagText(xml, "EX_MESSAGE")).toBe("Ошибка");
	});
});

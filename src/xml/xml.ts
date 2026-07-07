export type XmlPrimitive = string | number | null | undefined;

export function escapeXmlValue(value: XmlPrimitive) {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");
}

function buildXmlTag(name: string, value: XmlPrimitive) {
	return `<${name}>${escapeXmlValue(value)}</${name}>`;
}

export function buildXmlFields(fields: Record<string, XmlPrimitive>) {
	return Object.entries(fields)
		.map(([name, value]) => buildXmlTag(name, value))
		.join("");
}

export function getXmlTagText(xml: string, tagName: string) {
	const parser = new DOMParser();

	const xmlDoc = parser.parseFromString(xml, "application/xml");
	const value = xmlDoc.getElementsByTagName(tagName)[0]?.textContent;

	return value?.trim() || undefined;
}

import { truncateText } from "../formatters";

import { sanitizeDetail } from "./safeValue";

import type { ErrorReportBreadcrumb } from "./types";

const MAX_BREADCRUMBS = 80;
const MAX_ELEMENT_CHAIN = 20;
const MAX_TEXT_LENGTH = 80;
const MAX_ATTRIBUTE_LENGTH = 120;
const CLICK_TARGET_SELECTOR = [
	"button",
	"a",
	"input",
	"select",
	"textarea",
	"[role]",
	"[aria-label]",
	"[title]",
	"[data-ui]",
	"[data-action]"
].join(",");

let breadcrumbs: ErrorReportBreadcrumb[] = [];

function nowUtc() {
	return new Date().toISOString();
}

export function addErrorReportBreadcrumb(breadcrumb: Omit<ErrorReportBreadcrumb, "utc"> & { utc?: string }) {
	breadcrumbs = [...breadcrumbs, { ...breadcrumb, utc: breadcrumb.utc ?? nowUtc() }].slice(-MAX_BREADCRUMBS);
}

export function getErrorReportBreadcrumbs() {
	return breadcrumbs;
}

export function clearErrorReportBreadcrumbs() {
	breadcrumbs = [];
}

function truncateAttributeText(value: string | null | undefined) {
	return truncateText(value, MAX_ATTRIBUTE_LENGTH);
}

function readStableAttributes(element: Element) {
	return {
		id: truncateAttributeText(element.id),
		role: truncateAttributeText(element.getAttribute("role")),
		type: truncateAttributeText(element.getAttribute("type")),
		title: truncateAttributeText(element.getAttribute("title")),
		ariaLabel: truncateAttributeText(element.getAttribute("aria-label")),
		dataUi: truncateAttributeText(element.getAttribute("data-ui")),
		dataAction: truncateAttributeText(element.getAttribute("data-action"))
	};
}

function readClickText(element: Element) {
	if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
		return undefined;
	}

	if (!element.matches("button,a,[role],[aria-label],[title]")) return undefined;

	return truncateText(element.textContent, MAX_TEXT_LENGTH);
}

function escapeSelectorPart(value: string) {
	if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
		return CSS.escape(value);
	}

	return value.replace(/["\\#.[\]>~+:]/g, "\\$&");
}

function buildElementSelector(element: Element) {
	const attrs = readStableAttributes(element);
	const parts = [element.tagName.toLowerCase()];

	if (attrs.id) parts.push(`#${escapeSelectorPart(attrs.id)}`);
	if (attrs.role) parts.push(`[role="${attrs.role}"]`);
	if (attrs.type) parts.push(`[type="${attrs.type}"]`);
	if (attrs.dataUi) parts.push(`[data-ui="${attrs.dataUi}"]`);
	if (attrs.dataAction) parts.push(`[data-action="${attrs.dataAction}"]`);

	return parts.join("");
}

function describeElement(element: Element) {
	const attrs = readStableAttributes(element);

	return {
		tag: element.tagName.toLowerCase(),
		selector: buildElementSelector(element),
		text: readClickText(element),
		...attrs
	};
}

function compactElementDescription(description: ReturnType<typeof describeElement>) {
	return Object.fromEntries(
		Object.entries(description).filter(([, value]) => value !== undefined && (!Array.isArray(value) || value.length > 0))
	);
}

function getClickElementChain(target: Element) {
	const chain: Element[] = [];
	let current: Element | null = target;

	while (current && current !== document.documentElement && chain.length < MAX_ELEMENT_CHAIN) {
		chain.push(current);
		if (current === document.body) break;
		current = current.parentElement;
	}

	return chain;
}

function findMeaningfulClickTarget(target: Element) {
	return target.closest(CLICK_TARGET_SELECTOR) ?? target;
}

function describeClickTarget(target: EventTarget | null) {
	if (!(target instanceof Element)) return undefined;

	const meaningfulTarget = findMeaningfulClickTarget(target);
	const chain = getClickElementChain(meaningfulTarget);

	return chain.map((element) => buildElementSelector(element)).join(" > ");
}

function describeClickDetail(event: MouseEvent) {
	const target = event.target instanceof Element ? event.target : undefined;
	const meaningfulTarget = target ? findMeaningfulClickTarget(target) : undefined;
	const chain = meaningfulTarget
		? getClickElementChain(meaningfulTarget).map((element) => compactElementDescription(describeElement(element)))
		: [];

	return sanitizeDetail({
		button: event.button,
		ctrlKey: event.ctrlKey,
		shiftKey: event.shiftKey,
		altKey: event.altKey,
		clientX: event.clientX,
		clientY: event.clientY,
		target: meaningfulTarget ? compactElementDescription(describeElement(meaningfulTarget)) : undefined,
		chain
	});
}

/**
 * Подключает breadcrumbs по действиям пользователя без тел запросов.
 */
export function installErrorReportBrowserBreadcrumbs() {
	if (typeof window === "undefined") return () => undefined;

	const onClick = (event: MouseEvent) => {
		addErrorReportBreadcrumb({
			type: "click",
			target: describeClickTarget(event.target),
			detail: describeClickDetail(event)
		});
	};

	const onVisibilityChange = () => {
		addErrorReportBreadcrumb({
			type: "visibility",
			detail: sanitizeDetail({ visibilityState: document.visibilityState })
		});
	};

	window.addEventListener("click", onClick, true);
	document.addEventListener("visibilitychange", onVisibilityChange);

	return () => {
		window.removeEventListener("click", onClick, true);
		document.removeEventListener("visibilitychange", onVisibilityChange);
	};
}

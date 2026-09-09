import { truncateText } from "../formatters";

import { sanitizeDetail, sanitizeDiagnosticText } from "./safeValue";

import type { ErrorReportBreadcrumb } from "./types";

const MAX_BREADCRUMBS = 80;
const MAX_ELEMENT_CHAIN = 20;
const MAX_ATTRIBUTE_LENGTH = 120;
const INTERACTIVE_CLICK_TARGET_SELECTOR = ["button", "a", "input", "select", "textarea", "[role]"].join(",");
const SAFE_TARGET_VALUE = /^[a-z0-9][a-z0-9._:/-]*$/i;

let breadcrumbs: ErrorReportBreadcrumb[] = [];

function nowUtc() {
	return new Date().toISOString();
}

export function addErrorReportBreadcrumb(breadcrumb: Omit<ErrorReportBreadcrumb, "utc"> & { utc?: string }) {
	breadcrumbs = [
		...breadcrumbs,
		{
			...breadcrumb,
			utc: sanitizeDiagnosticText(breadcrumb.utc ?? nowUtc(), 64),
			routeId: breadcrumb.routeId
				? sanitizeDiagnosticText(breadcrumb.routeId.split(/[?#]/, 1)[0] ?? breadcrumb.routeId, 512)
				: undefined,
			appId: breadcrumb.appId ? sanitizeDiagnosticText(breadcrumb.appId, 128) : undefined,
			viewId: breadcrumb.viewId ? sanitizeDiagnosticText(breadcrumb.viewId, 128) : undefined,
			target: breadcrumb.target ? sanitizeDiagnosticText(breadcrumb.target, 2_048) : undefined,
			detail: sanitizeDetail(breadcrumb.detail, {
				scope: "breadcrumb-detail",
				source: breadcrumb.type
			})
		}
	].slice(-MAX_BREADCRUMBS);
}

export function getErrorReportBreadcrumbs() {
	return breadcrumbs.slice();
}

export function clearErrorReportBreadcrumbs() {
	breadcrumbs = [];
}

function truncateAttributeText(value: string | null | undefined) {
	return truncateText(value, MAX_ATTRIBUTE_LENGTH);
}

function readSafeTargetValue(element: Element) {
	const value = truncateAttributeText(element.getAttribute("data-error-report-target"));
	return value && SAFE_TARGET_VALUE.test(value) ? value : undefined;
}

function readTechnicalAttribute(element: Element, name: string) {
	const value = truncateAttributeText(element.getAttribute(name));
	return value && SAFE_TARGET_VALUE.test(value) ? value : undefined;
}

function readTechnicalAttributes(element: Element) {
	const errorReportTarget = readSafeTargetValue(element);

	// Специализированный маркер однозначно переопределяет прежнюю host-разметку.
	// Fallback сохраняет уже внедрённые data-ui/data-action без возврата к DOM text.
	return {
		role: readTechnicalAttribute(element, "role"),
		type: readTechnicalAttribute(element, "type"),
		errorReportTarget,
		dataUi: errorReportTarget ? undefined : readTechnicalAttribute(element, "data-ui"),
		dataAction: errorReportTarget ? undefined : readTechnicalAttribute(element, "data-action")
	};
}

function escapeSelectorPart(value: string) {
	if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
		return CSS.escape(value);
	}

	return value.replace(/["\\#.[\]>~+:]/g, "\\$&");
}

function buildElementSelector(element: Element) {
	const attrs = readTechnicalAttributes(element);
	const parts = [element.tagName.toLowerCase()];

	if (attrs.role) parts.push(`[role="${attrs.role}"]`);
	if (attrs.type) parts.push(`[type="${attrs.type}"]`);
	if (attrs.errorReportTarget) {
		parts.push(`[data-error-report-target="${escapeSelectorPart(attrs.errorReportTarget)}"]`);
	} else {
		if (attrs.dataUi) parts.push(`[data-ui="${escapeSelectorPart(attrs.dataUi)}"]`);
		if (attrs.dataAction) parts.push(`[data-action="${escapeSelectorPart(attrs.dataAction)}"]`);
	}

	return parts.join("");
}

function describeElement(element: Element) {
	const attrs = readTechnicalAttributes(element);

	return {
		tag: element.tagName.toLowerCase(),
		selector: buildElementSelector(element),
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
	const chain = getClickElementChain(target);
	const explicitTarget = chain.find((element) => readSafeTargetValue(element));
	if (explicitTarget) return explicitTarget;

	return (
		chain.find(
			(element) =>
				element.matches(INTERACTIVE_CLICK_TARGET_SELECTOR) ||
				readTechnicalAttribute(element, "data-action") !== undefined ||
				readTechnicalAttribute(element, "data-ui") !== undefined
		) ?? target
	);
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

	return sanitizeDetail(
		{
			button: event.button,
			ctrlKey: event.ctrlKey,
			shiftKey: event.shiftKey,
			altKey: event.altKey,
			clientX: event.clientX,
			clientY: event.clientY,
			target: meaningfulTarget ? compactElementDescription(describeElement(meaningfulTarget)) : undefined,
			chain
		},
		{ scope: "breadcrumb-detail", source: "click" }
	);
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
			detail: sanitizeDetail({ visibilityState: document.visibilityState }, { scope: "breadcrumb-detail", source: "visibility" })
		});
	};

	window.addEventListener("click", onClick, true);
	document.addEventListener("visibilitychange", onVisibilityChange);

	return () => {
		window.removeEventListener("click", onClick, true);
		document.removeEventListener("visibilitychange", onVisibilityChange);
	};
}

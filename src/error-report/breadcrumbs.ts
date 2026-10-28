import { truncateText } from "../formatters";

import { getErrorReportCaptureOptions } from "./captureOptions";
import { ERROR_REPORT_VALUE_POLICY_VERBATIM } from "./capturePolicyConstants";
import {
	ERROR_REPORT_UTC_MAX_LENGTH,
	ERROR_REPORT_BREADCRUMB_ROUTE_MAX_LENGTH,
	ERROR_REPORT_BREADCRUMB_APP_MAX_LENGTH,
	ERROR_REPORT_BREADCRUMB_VIEW_MAX_LENGTH,
	ERROR_REPORT_BREADCRUMB_TARGET_MAX_LENGTH,
	ERROR_REPORT_BREADCRUMBS_MAX_ITEMS
} from "./errorReportCaptureLimits";
import {
	ERROR_REPORT_SCOPE_BREADCRUMB_DETAIL,
	ERROR_REPORT_BREADCRUMB_CLICK,
	ERROR_REPORT_BREADCRUMB_VISIBILITY
} from "./errorReportContractConstants";
import { sanitizeDetail, sanitizeDiagnosticText } from "./safeValue";

import type { ErrorReportBreadcrumb } from "./types";

const CLICK_EVENT = "click";
const VISIBILITY_CHANGE_EVENT = "visibilitychange";
const ERROR_REPORT_TARGET_ATTRIBUTE = "data-error-report-target";
const DATA_UI_ATTRIBUTE = "data-ui";
const DATA_ACTION_ATTRIBUTE = "data-action";
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
			utc: sanitizeDiagnosticText(breadcrumb.utc ?? nowUtc(), ERROR_REPORT_UTC_MAX_LENGTH),
			routeId: breadcrumb.routeId
				? sanitizeDiagnosticText(
						getErrorReportCaptureOptions().valuePolicy === ERROR_REPORT_VALUE_POLICY_VERBATIM
							? breadcrumb.routeId
							: (breadcrumb.routeId.split(/[?#]/, 1)[0] ?? breadcrumb.routeId),
						ERROR_REPORT_BREADCRUMB_ROUTE_MAX_LENGTH
					)
				: undefined,
			appId: breadcrumb.appId ? sanitizeDiagnosticText(breadcrumb.appId, ERROR_REPORT_BREADCRUMB_APP_MAX_LENGTH) : undefined,
			viewId: breadcrumb.viewId ? sanitizeDiagnosticText(breadcrumb.viewId, ERROR_REPORT_BREADCRUMB_VIEW_MAX_LENGTH) : undefined,
			target: breadcrumb.target ? sanitizeDiagnosticText(breadcrumb.target, ERROR_REPORT_BREADCRUMB_TARGET_MAX_LENGTH) : undefined,
			detail: sanitizeDetail(breadcrumb.detail, {
				scope: ERROR_REPORT_SCOPE_BREADCRUMB_DETAIL,
				source: breadcrumb.type
			})
		}
	].slice(-ERROR_REPORT_BREADCRUMBS_MAX_ITEMS);
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
	const value = truncateAttributeText(element.getAttribute(ERROR_REPORT_TARGET_ATTRIBUTE));
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
		dataUi: errorReportTarget ? undefined : readTechnicalAttribute(element, DATA_UI_ATTRIBUTE),
		dataAction: errorReportTarget ? undefined : readTechnicalAttribute(element, DATA_ACTION_ATTRIBUTE)
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
		parts.push(`[${ERROR_REPORT_TARGET_ATTRIBUTE}="${escapeSelectorPart(attrs.errorReportTarget)}"]`);
	} else {
		if (attrs.dataUi) parts.push(`[${DATA_UI_ATTRIBUTE}="${escapeSelectorPart(attrs.dataUi)}"]`);
		if (attrs.dataAction) parts.push(`[${DATA_ACTION_ATTRIBUTE}="${escapeSelectorPart(attrs.dataAction)}"]`);
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
				readTechnicalAttribute(element, DATA_ACTION_ATTRIBUTE) !== undefined ||
				readTechnicalAttribute(element, DATA_UI_ATTRIBUTE) !== undefined
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
		{ scope: ERROR_REPORT_SCOPE_BREADCRUMB_DETAIL, source: ERROR_REPORT_BREADCRUMB_CLICK }
	);
}

/**
 * Подключает breadcrumbs по действиям пользователя без тел запросов.
 */
export function installErrorReportBrowserBreadcrumbs() {
	if (typeof window === "undefined") return () => undefined;

	const onClick = (event: MouseEvent) => {
		addErrorReportBreadcrumb({
			type: ERROR_REPORT_BREADCRUMB_CLICK,
			target: describeClickTarget(event.target),
			detail: describeClickDetail(event)
		});
	};

	const onVisibilityChange = () => {
		addErrorReportBreadcrumb({
			type: ERROR_REPORT_BREADCRUMB_VISIBILITY,
			detail: sanitizeDetail(
				{ visibilityState: document.visibilityState },
				{ scope: ERROR_REPORT_SCOPE_BREADCRUMB_DETAIL, source: ERROR_REPORT_BREADCRUMB_VISIBILITY }
			)
		});
	};

	window.addEventListener(CLICK_EVENT, onClick, true);
	document.addEventListener(VISIBILITY_CHANGE_EVENT, onVisibilityChange);

	return () => {
		window.removeEventListener(CLICK_EVENT, onClick, true);
		document.removeEventListener(VISIBILITY_CHANGE_EVENT, onVisibilityChange);
	};
}

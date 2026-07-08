// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clearErrorReportBreadcrumbs, getErrorReportBreadcrumbs, installErrorReportBrowserBreadcrumbs } from "./breadcrumbs";

describe("error-report breadcrumbs", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		clearErrorReportBreadcrumbs();
	});

	afterEach(() => {
		clearErrorReportBreadcrumbs();
		document.body.innerHTML = "";
	});

	it("сохраняет читаемую HTML-цепочку без CSS classes для клика", () => {
		const dispose = installErrorReportBrowserBreadcrumbs();
		const container = document.createElement("section");
		container.id = "toolbar";
		container.className = "_toolbar_a1b2c globalToolbar";
		container.innerHTML = `
			<button
				type="button"
				aria-label="Отправить отчет"
				data-ui="error-report-send-button"
				data-action="send-error-report"
				class="_sendButton_x9y8z globalAction"
			>
				<span class="_label_qwert">Отправить</span>
			</button>
		`;
		document.body.append(container);

		const label = container.querySelector("span");
		label?.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 12, clientY: 34 }));

		dispose();

		const [breadcrumb] = getErrorReportBreadcrumbs();
		expect(breadcrumb?.type).toBe("click");
		expect(breadcrumb?.target).toContain('button[type="button"][data-ui="error-report-send-button"][data-action="send-error-report"]');

		const detail = breadcrumb?.detail as Record<string, unknown>;
		const target = detail.target as Record<string, unknown>;
		const chain = detail.chain as Record<string, unknown>[];

		expect(detail.clientX).toBe(12);
		expect(detail.clientY).toBe(34);
		expect(target).toMatchObject({
			tag: "button",
			ariaLabel: "Отправить отчет",
			dataUi: "error-report-send-button",
			dataAction: "send-error-report",
			text: "Отправить"
		});
		expect(target.classes).toBeUndefined();
		expect(target.stableClasses).toBeUndefined();
		expect(chain[0]).toMatchObject({
			tag: "button"
		});
		expect(chain[0]?.classes).toBeUndefined();
		expect(chain[0]?.stableClasses).toBeUndefined();
		expect(chain[1]).toMatchObject({
			tag: "section",
			id: "toolbar"
		});
		expect(chain[1]?.classes).toBeUndefined();
		expect(chain[1]?.stableClasses).toBeUndefined();
	});
});

// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	addErrorReportBreadcrumb,
	clearErrorReportBreadcrumbs,
	getErrorReportBreadcrumbs,
	installErrorReportBrowserBreadcrumbs
} from "./breadcrumbs";

describe("error-report breadcrumbs", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		clearErrorReportBreadcrumbs();
	});

	afterEach(() => {
		clearErrorReportBreadcrumbs();
		document.body.innerHTML = "";
	});

	it("предпочитает явный безопасный target прежним техническим атрибутам", () => {
		const dispose = installErrorReportBrowserBreadcrumbs();
		const container = document.createElement("section");
		container.id = "toolbar";
		container.className = "_toolbar_a1b2c globalToolbar";
		container.innerHTML = `
			<button
				type="button"
				id="user@example.com"
				aria-label="Отправить отчет пользователя user@example.com"
				title="Телефон +7 900 000-00-00"
				data-ui="error-report-send-button"
				data-action="send-error-report"
				data-error-report-target="send-error-report"
				class="_sendButton_x9y8z globalAction"
			>
				<span data-ui="nested-label" data-action="nested-action" class="_label_qwert">Отправить</span>
			</button>
		`;
		document.body.append(container);

		const label = container.querySelector("span");
		label?.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 12, clientY: 34 }));

		dispose();

		const [breadcrumb] = getErrorReportBreadcrumbs();
		expect(breadcrumb?.type).toBe("click");
		expect(breadcrumb?.target).toContain('button[type="button"][data-error-report-target="send-error-report"]');

		const detail = breadcrumb?.detail as Record<string, unknown>;
		const target = detail.target as Record<string, unknown>;
		const chain = detail.chain as Record<string, unknown>[];

		expect(detail.clientX).toBe(12);
		expect(detail.clientY).toBe(34);
		expect(target).toMatchObject({
			tag: "button",
			type: "button",
			errorReportTarget: "send-error-report"
		});
		expect(JSON.stringify(breadcrumb)).not.toContain("user@example.com");
		expect(JSON.stringify(breadcrumb)).not.toContain("Отправить отчет пользователя");
		expect(JSON.stringify(breadcrumb)).not.toContain("+7 900 000-00-00");
		expect(JSON.stringify(breadcrumb)).not.toContain("data-ui");
		expect(JSON.stringify(breadcrumb)).not.toContain("data-action");
		expect(chain[0]).toMatchObject({
			tag: "button"
		});
		expect(chain[0]?.classes).toBeUndefined();
		expect(chain[0]?.stableClasses).toBeUndefined();
		expect(chain[1]).toMatchObject({ tag: "section" });
		expect(chain[1]?.classes).toBeUndefined();
		expect(chain[1]?.stableClasses).toBeUndefined();
	});

	it("использует data-ui и data-action как fallback без явного target", () => {
		const dispose = installErrorReportBrowserBreadcrumbs();
		const container = document.createElement("section");
		container.innerHTML = `
			<div data-ui="filter-panel-apply" data-action="apply-filters">
				<span>Применить фильтры пользователя user@example.com</span>
			</div>
		`;
		document.body.append(container);

		container.querySelector("span")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		dispose();

		const [breadcrumb] = getErrorReportBreadcrumbs();
		expect(breadcrumb?.target).toContain('div[data-ui="filter-panel-apply"][data-action="apply-filters"]');
		expect(breadcrumb?.detail).toMatchObject({
			target: {
				tag: "div",
				dataUi: "filter-panel-apply",
				dataAction: "apply-filters"
			}
		});
		expect(JSON.stringify(breadcrumb)).not.toContain("user@example.com");
		expect(JSON.stringify(breadcrumb)).not.toContain("Применить фильтры пользователя");
	});

	it("отбрасывает свободные fallback-значения и сохраняет только slug-like атрибуты", () => {
		const dispose = installErrorReportBrowserBreadcrumbs();
		const button = document.createElement("button");
		button.dataset.errorReportTarget = "Профиль пользователя 123456";
		button.dataset.ui = "Профиль пользователя 123456";
		button.dataset.action = "open-profile";
		document.body.append(button);

		button.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		dispose();

		const [breadcrumb] = getErrorReportBreadcrumbs();
		expect(breadcrumb?.target).toContain('button[data-action="open-profile"]');
		expect(breadcrumb?.target).not.toContain("data-ui");
		expect(JSON.stringify(breadcrumb)).not.toContain("123456");
	});

	it("очищает route search/hash и не отдаёт наружу сам массив breadcrumbs", () => {
		addErrorReportBreadcrumb({
			type: "route",
			routeId: "/workspace/students?token=secret#profile",
			detail: { password: "secret-password" }
		});

		const snapshot = getErrorReportBreadcrumbs();
		snapshot.pop();

		expect(getErrorReportBreadcrumbs()).toMatchObject([
			{
				routeId: "/workspace/students",
				detail: { password: "[REDACTED]" }
			}
		]);
	});
});

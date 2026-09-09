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

	it("сохраняет только техническую HTML-цепочку и явный безопасный target", () => {
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
				<span class="_label_qwert">Отправить</span>
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

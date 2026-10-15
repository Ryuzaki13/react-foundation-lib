// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { installFaviconOverride } from "./installFaviconOverride";

afterEach(() => document.head.replaceChildren());

describe("temporary favicon", () => {
	it("восстанавливает атрибуты, сохраняя media и чужие links", () => {
		const icon = document.createElement("link");
		icon.rel = "icon";
		icon.href = "/original.ico";
		icon.type = "image/x-icon";
		icon.media = "(prefers-color-scheme: dark)";
		const apple = document.createElement("link");
		apple.rel = "apple-touch-icon";
		apple.href = "/apple.png";
		document.head.append(icon, apple);
		const release = installFaviconOverride(document, "/unread.svg");
		expect(icon.getAttribute("href")).toBe("/unread.svg");
		expect(icon.type).toBe("image/svg+xml");
		expect(icon.media).toBe("(prefers-color-scheme: dark)");
		release();
		release();
		expect(icon.getAttribute("href")).toBe("/original.ico");
		expect(icon.type).toBe("image/x-icon");
		expect(icon.hasAttribute("sizes")).toBe(false);
		expect(apple.getAttribute("href")).toBe("/apple.png");
	});
	it("cleanup не затирает более позднее изменение другого владельца", () => {
		const icon = document.createElement("link");
		icon.rel = "icon";
		document.head.append(icon);
		const release = installFaviconOverride(document, "/unread.svg");
		icon.href = "/new.svg";
		release();
		expect(icon.getAttribute("href")).toBe("/new.svg");
	});
});

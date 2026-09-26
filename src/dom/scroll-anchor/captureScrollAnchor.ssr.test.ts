import { expect, it } from "vitest";

import { captureScrollAnchor } from "../index";

it("публичный DOM subpath импортируется без window/document; null refs не создают browser side effects", () => {
	expect(typeof window).toBe("undefined");
	expect(typeof document).toBe("undefined");
	expect(captureScrollAnchor(null, null)).toBeNull();
});

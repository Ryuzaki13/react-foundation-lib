import { describe, expect, it } from "vitest";

import { resolveTableColumnsWidth } from "./resolveTableColumnsWidth";

describe("суммарная ширина колонок", () => {
	it("сохраняет относительные и смешанные единицы для расчёта браузером", () => {
		expect(resolveTableColumnsWidth(["4em", "20em", "10.125em"])).toBe("calc(4em + 20em + 10.125em)");
		expect(resolveTableColumnsWidth(["4em", "120px"])).toBe("calc(4em + 120px)");
		expect(resolveTableColumnsWidth(["12em"])).toBe("12em");
	});

	it.each([[], ["auto"], ["10em", "50%"], ["-1em"], ["NaNem"], ["12em; color: red"], ["Infinitypx"]])(
		"оставляет неопределённую или некорректную ширину браузерной раскладке: %j",
		(...widths) => {
			expect(resolveTableColumnsWidth(widths)).toBeUndefined();
		}
	);
});

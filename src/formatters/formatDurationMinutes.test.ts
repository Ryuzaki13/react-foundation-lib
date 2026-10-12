import { describe, expect, it } from "vitest";

import { formatDurationMinutes } from "./formatDurationMinutes";

describe("formatDurationMinutes", () => {
	it.each([
		[0, "0 мин"],
		[1, "1 мин"],
		[59, "59 мин"],
		[60, "1 ч 0 мин"],
		[61, "1 ч 1 мин"],
		[119, "1 ч 59 мин"],
		[120, "2 ч 0 мин"],
		[1439, "23 ч 59 мин"],
		[1440, "1 дн 0 ч 0 мин"],
		[1441, "1 дн 0 ч 1 мин"],
		[1500, "1 дн 1 ч 0 мин"],
		[1565, "1 дн 2 ч 5 мин"],
		[2880, "2 дн 0 ч 0 мин"],
		[4321, "3 дн 0 ч 1 мин"]
	])("форматирует %s минут", (minutes, expected) => {
		expect(formatDurationMinutes(minutes)).toBe(expected);
	});

	it.each([-1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
		"не подменяет недопустимую длительность %s нулём",
		(minutes) => {
			expect(() => formatDurationMinutes(minutes)).toThrow(RangeError);
		}
	);

	it("не обрезает многодневный период до календарных часов", () => {
		expect(formatDurationMinutes(1000 * 24 * 60 + 65)).toBe("1 000 дн 1 ч 5 мин");
	});
});

import { describe, expect, it } from "vitest";

import { formatInstantDateTime } from "./formatInstantDateTime";

describe("formatInstantDateTime", () => {
	it("форматирует один UTC instant в явно заданных часовых поясах", () => {
		const timestamp = "2026-09-04T10:22:28.567Z";

		expect(formatInstantDateTime(timestamp, { timeZone: "UTC" })).toBe("4 сент. 2026 г., 10:22:28");
		expect(formatInstantDateTime(timestamp, { timeZone: "Asia/Yekaterinburg" })).toBe("4 сент. 2026 г., 15:22:28");
	});

	it("сохраняет момент времени из ISO со смещением", () => {
		expect(formatInstantDateTime("2026-09-04T15:22:28+05:00", { timeZone: "Asia/Yekaterinburg" })).toBe("4 сент. 2026 г., 15:22:28");
	});

	it("поддерживает явные locale и уровни детализации", () => {
		expect(
			formatInstantDateTime("2026-09-04T10:22:28Z", {
				timeZone: "Asia/Yekaterinburg",
				locale: "en-GB",
				dateStyle: "short",
				timeStyle: "short"
			})
		).toBe("04/09/2026, 15:22");
	});

	it("возвращает fallback для невалидного timestamp или timezone", () => {
		expect(formatInstantDateTime("not-a-date", { timeZone: "Asia/Yekaterinburg", fallback: "—" })).toBe("—");
		expect(formatInstantDateTime("2026-09-04T10:22:28Z", { timeZone: "Invalid/Timezone", fallback: "—" })).toBe("—");
	});
});

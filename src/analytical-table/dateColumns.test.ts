import { describe, expect, it } from "vitest";

import { aggregateAnalyticalDateFacts, createAnalyticalDateColumnsPlan, projectAnalyticalDateFacts } from "./index";
import { type AnalyticalDateColumnsOptions } from "./index";

const options: AnalyticalDateColumnsOptions = {
	id: "attendance",
	from: "2026-01-30",
	to: "2026-02-02",
	granularity: "month",
	identityColumnIds: ["unit", "person"],
	dateColumnId: "date",
	measureColumnId: "value",
	aggregation: "sum"
};

describe("динамические календарные столбцы", () => {
	it("ограничивает крайние buckets диапазоном и сохраняет ID на границах месяца", () => {
		const plan = createAnalyticalDateColumnsPlan(options);
		expect(plan.columns.map((column) => [column.id, column.from, column.to])).toEqual([
			["attendance:month:2026-01-01", "2026-01-30", "2026-01-31"],
			["attendance:month:2026-02-01", "2026-02-01", "2026-02-02"]
		]);
	});
	it("сопоставляет составной ключ без размножения base rows и не мутирует снимок", () => {
		const plan = createAnalyticalDateColumnsPlan(options);
		const rows = [
			{ id: "first", values: Object.freeze({ unit: 1, person: 2 }) },
			{ id: "second", values: { unit: 2, person: 2 } }
		];
		const result = projectAnalyticalDateFacts({
			rows,
			plan,
			facts: [
				{ unit: 1, person: 2, date: "2026-01-30", value: 2 },
				{ unit: 1, person: 2, date: "2026-01-31", value: 3 },
				{ unit: 2, person: 2, date: "2026-02-01", value: 7 },
				{ unit: 1, person: 2, date: "2026-01-29", value: 100 },
				{ unit: 1, person: 2, date: "bad", value: 100 },
				{ unit: 1, date: "2026-01-30", value: 100 }
			]
		});
		expect(result.map((item) => item.id)).toEqual(["first", "second"]);
		expect(result[0].values[plan.columns[0].id]).toBe(5);
		expect(result[0].values[plan.columns[1].id]).toBeNull();
		expect(result[1].values[plan.columns[1].id]).toBe(7);
		expect(rows[0].values).toEqual({ unit: 1, person: 2 });
	});
	it("общий avg вычисляется по всем фактам, а не по средним строк", () => {
		const plan = createAnalyticalDateColumnsPlan({ ...options, aggregation: "avg" });
		const facts = [
			{ unit: 1, person: 2, date: "2026-01-30", value: 1 },
			{ unit: 1, person: 2, date: "2026-01-30", value: 3 },
			{ unit: 2, person: 3, date: "2026-01-31", value: 20 }
		];
		expect(aggregateAnalyticalDateFacts(facts, plan)[plan.columns[0].id]).toBe(8);
	});
	it("не включает факты с неполным ключом ни в строки, ни в общий итог", () => {
		const plan = createAnalyticalDateColumnsPlan(options);
		const facts = [
			{ unit: 1, person: 2, date: "2026-01-30", value: 3 },
			{ unit: 1, person: null, date: "2026-01-30", value: 100 },
			{ person: 2, date: "2026-01-30", value: 100 }
		];
		const projected = projectAnalyticalDateFacts({ rows: [{ id: "a", values: { unit: 1, person: 2 } }], facts, plan });
		expect(projected[0].values[plan.columns[0].id]).toBe(3);
		expect(aggregateAnalyticalDateFacts(facts, plan)[plan.columns[0].id]).toBe(3);
	});
	it.each(["day", "week", "month", "quarter", "year"] as const)("строит %s с включительным концом диапазона", (granularity) => {
		const plan = createAnalyticalDateColumnsPlan({ ...options, from: "2024-02-28", to: "2024-03-01", granularity });
		expect(plan.columns[0].from).toBe("2024-02-28");
		expect(plan.columns.at(-1)?.to).toBe("2024-03-01");
		if (granularity === "day") expect(plan.columns).toHaveLength(3);
		if (granularity === "week") expect(plan.columns[0].id).toBe("attendance:week:2024-02-26");
	});
	it("отклоняет неправильные даты, перевёрнутый диапазон и превышение лимита", () => {
		expect(() => createAnalyticalDateColumnsPlan({ ...options, from: "2026-02-30" })).toThrow("Некорректный");
		expect(() => createAnalyticalDateColumnsPlan({ ...options, from: "2027-01-01" })).toThrow("Некорректный");
		expect(() => createAnalyticalDateColumnsPlan({ ...options, granularity: "day", maxColumns: 1 })).toThrow("лимит");
	});
	it("не перезаписывает исходный столбец с совпавшим идентификатором", () => {
		const plan = createAnalyticalDateColumnsPlan(options);
		expect(() => projectAnalyticalDateFacts({ plan, facts: [], rows: [{ id: "a", values: { [plan.columns[0].id]: 1 } }] })).toThrow(
			"перезаписывает"
		);
	});
});

describe("календарный контракт между SSR и браузером", () => {
	it("не интерпретирует Date и ISO timestamp как календарный факт", () => {
		const plan = createAnalyticalDateColumnsPlan(options);
		const result = aggregateAnalyticalDateFacts(
			[
				{ unit: 1, person: 2, date: new Date("2026-01-30T23:30:00Z"), value: 100 },
				{ unit: 1, person: 2, date: "2026-01-30T23:30:00Z", value: 100 },
				{ unit: 1, person: 2, date: "2026-01-30", value: 2 }
			],
			plan
		);
		expect(result[plan.columns[0].id]).toBe(2);
	});
	it("для canonical дат возвращает одинаковые buckets в разных timezone", () => {
		const initial = process.env.TZ;
		try {
			const results = ["UTC", "Asia/Yekaterinburg", "America/Los_Angeles"].map((zone) => {
				process.env.TZ = zone;
				const plan = createAnalyticalDateColumnsPlan({ ...options, granularity: "day" });
				return {
					columns: plan.columns,
					values: aggregateAnalyticalDateFacts([{ unit: 1, person: 2, date: "2026-01-30", value: 2 }], plan)
				};
			});
			expect(results[1]).toEqual(results[0]);
			expect(results[2]).toEqual(results[0]);
		} finally {
			if (initial === undefined) delete process.env.TZ;
			else process.env.TZ = initial;
		}
	});
});

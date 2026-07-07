import { describe, expect, it } from "vitest";

import { buildSqlFilter, createSqlFilterEqual, createSqlFilterIn } from "./sqlFilters";

describe("buildSqlFilter", () => {
	it("собирает равенство и IN с экранированием строковых значений", () => {
		const filter = buildSqlFilter([
			createSqlFilterEqual("FIELD1", "VALUE1"),
			createSqlFilterEqual("FIELD2", "O'Hara"),
			createSqlFilterIn("STATUS", ["S1", "S'2", "S3"])
		]);

		expect(filter).toBe("FIELD1='VALUE1' AND FIELD2='O''Hara' AND STATUS IN ('S1', 'S''2', 'S3')");
	});

	it("пропускает пустые и неподдерживаемые значения", () => {
		const filter = buildSqlFilter([
			createSqlFilterEqual("EMPTY", ""),
			createSqlFilterEqual("SPACE", "   "),
			createSqlFilterEqual("OBJECT_VALUE", { value: "ignored" }),
			createSqlFilterEqual("NUMBER_VALUE", Number.NaN),
			createSqlFilterIn("EMPTY_LIST", []),
			createSqlFilterIn("MIXED_LIST", [undefined, null, "", "A"])
		]);

		expect(filter).toBe("MIXED_LIST IN ('A')");
	});

	it("сериализует number и boolean как строковые литералы", () => {
		const filter = buildSqlFilter([createSqlFilterEqual("COUNT_VALUE", 42), createSqlFilterEqual("FLAG_VALUE", true)]);

		expect(filter).toBe("COUNT_VALUE='42' AND FLAG_VALUE='true'");
	});

	it("требует форматировать Date в вызывающем маппере", () => {
		expect(() => buildSqlFilter([createSqlFilterEqual("DATE_VALUE", new Date("2026-01-02T03:04:05.000Z"))])).toThrow(
			"Дата должна быть отформатирована вызывающей стороной до формирования SQL-фильтра"
		);
	});

	it("запрещает идентификаторы, которые могут сломать dynamic WHERE", () => {
		expect(() => buildSqlFilter([createSqlFilterEqual("FIELD;DELETE", "X")])).toThrow(
			"Некорректное имя поля SQL-фильтра: FIELD;DELETE"
		);
		expect(() => buildSqlFilter([createSqlFilterEqual("t~field", "X")])).toThrow("Некорректное имя поля SQL-фильтра: t~field");
		expect(() => buildSqlFilter([createSqlFilterEqual("/BIC/ZFIELD", "X")])).toThrow("Некорректное имя поля SQL-фильтра: /BIC/ZFIELD");
	});
});

import { describe, expect, it } from "vitest";

import { buildSqlFilter, createSqlFilterEqual, createSqlFilterGroup, createSqlFilterIn } from "./sqlFilters";

describe("buildSqlFilter", () => {
	it("собирает равенство и IN с экранированием строковых значений", () => {
		const filter = buildSqlFilter([
			createSqlFilterEqual("FIELD1", "TEXT_VALUE1"),
			createSqlFilterEqual("FIELD2", "O'Hara"),
			createSqlFilterIn("STATUS", ["S1", "S'2", "S3"])
		]);

		expect(filter).toBe("FIELD1='TEXT_VALUE1' AND FIELD2='O''Hara' AND STATUS IN ('S1', 'S''2', 'S3')");
	});

	it("сохраняет OR-группу в скобках внутри общего AND-выражения", () => {
		const filter = buildSqlFilter([
			createSqlFilterGroup([createSqlFilterIn("ZDIV", ["01"]), createSqlFilterIn("ZCFO1", ["0202", "02'03"])], "or"),
			createSqlFilterEqual("STATUS", "A")
		]);

		expect(filter).toBe("(ZDIV IN ('01') OR ZCFO1 IN ('0202', '02''03')) AND STATUS='A'");
	});

	it("пропускает пустые элементы группы и не сериализует пустую группу", () => {
		const filter = buildSqlFilter([
			createSqlFilterGroup([createSqlFilterIn("EMPTY_LIST", []), createSqlFilterEqual("ACTIVE", "X")], "or"),
			createSqlFilterGroup([], "and")
		]);

		expect(filter).toBe("(ACTIVE='X')");
	});

	it("пропускает пустые и неподдерживаемые значения", () => {
		const filter = buildSqlFilter([
			createSqlFilterEqual("EMPTY", ""),
			createSqlFilterEqual("SPACE", "   "),
			createSqlFilterEqual("OBJECT_TEXT_VALUE", { value: "ignored" }),
			createSqlFilterEqual("NUMBER_TEXT_VALUE", Number.NaN),
			createSqlFilterIn("EMPTY_LIST", []),
			createSqlFilterIn("MIXED_LIST", [undefined, null, "", "A"])
		]);

		expect(filter).toBe("MIXED_LIST IN ('A')");
	});

	it("сериализует number и boolean как строковые литералы", () => {
		const filter = buildSqlFilter([createSqlFilterEqual("COUNT_TEXT_VALUE", 42), createSqlFilterEqual("FLAG_TEXT_VALUE", true)]);

		expect(filter).toBe("COUNT_TEXT_VALUE='42' AND FLAG_TEXT_VALUE='true'");
	});

	it("требует форматировать Date в вызывающем маппере", () => {
		expect(() => buildSqlFilter([createSqlFilterEqual("DATE_TEXT_VALUE", new Date("2026-01-02T03:04:05.000Z"))])).toThrow(
			"Дата должна быть отформатирована вызывающей стороной до формирования SQL-фильтра"
		);
	});

	it("запрещает идентификаторы, которые могут сломать dynamic WHERE", () => {
		expect(() => buildSqlFilter([createSqlFilterEqual("FIELD;DELETE", "X")])).toThrow(
			"Некорректное имя поля SQL-фильтра: FIELD;DELETE"
		);
		expect(() => buildSqlFilter([createSqlFilterEqual("t~field", "X")])).toThrow("Некорректное имя поля SQL-фильтра: t~field");
		expect(() => buildSqlFilter([createSqlFilterEqual("/TEXT/INVALID_FIELD", "X")])).toThrow(
			"Некорректное имя поля SQL-фильтра: /TEXT/INVALID_FIELD"
		);
	});
});

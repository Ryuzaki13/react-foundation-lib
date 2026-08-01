import { describe, expect, it } from "vitest";

import { formatRussianPlural, selectRussianPluralForm, type RussianPluralForms } from "./index";

const ELEMENT_FORMS: RussianPluralForms = {
	one: "элемент",
	few: "элемента",
	many: "элементов"
};

describe("selectRussianPluralForm", () => {
	it("выбирает основные формы и учитывает исключения от 11 до 14", () => {
		expect(selectRussianPluralForm(0, ELEMENT_FORMS)).toBe("элементов");
		expect(selectRussianPluralForm(1, ELEMENT_FORMS)).toBe("элемент");
		expect(selectRussianPluralForm(2, ELEMENT_FORMS)).toBe("элемента");
		expect(selectRussianPluralForm(4, ELEMENT_FORMS)).toBe("элемента");
		expect(selectRussianPluralForm(7, ELEMENT_FORMS)).toBe("элементов");
		expect(selectRussianPluralForm(11, ELEMENT_FORMS)).toBe("элементов");
		expect(selectRussianPluralForm(14, ELEMENT_FORMS)).toBe("элементов");
	});

	it("повторяет правила для следующих разрядов и отрицательных чисел", () => {
		expect(selectRussianPluralForm(21, ELEMENT_FORMS)).toBe("элемент");
		expect(selectRussianPluralForm(22, ELEMENT_FORMS)).toBe("элемента");
		expect(selectRussianPluralForm(25, ELEMENT_FORMS)).toBe("элементов");
		expect(selectRussianPluralForm(101, ELEMENT_FORMS)).toBe("элемент");
		expect(selectRussianPluralForm(112, ELEMENT_FORMS)).toBe("элементов");
		expect(selectRussianPluralForm(-2, ELEMENT_FORMS)).toBe("элемента");
	});

	it("использует отдельную или резервную форму для дробных чисел", () => {
		expect(selectRussianPluralForm(1.5, ELEMENT_FORMS)).toBe("элемента");
		expect(selectRussianPluralForm(1.5, { ...ELEMENT_FORMS, other: "элемента дробного" })).toBe("элемента дробного");
	});

	it("отклоняет значения, для которых невозможно определить количественную форму", () => {
		expect(() => selectRussianPluralForm(Number.NaN, ELEMENT_FORMS)).toThrow(RangeError);
		expect(() => selectRussianPluralForm(Number.POSITIVE_INFINITY, ELEMENT_FORMS)).toThrow(RangeError);
	});
});

describe("formatRussianPlural", () => {
	it("возвращает количество вместе с выбранной полной формой", () => {
		expect(formatRussianPlural(1, ELEMENT_FORMS)).toBe("1 элемент");
		expect(formatRussianPlural(2, ELEMENT_FORMS)).toBe("2 элемента");
		expect(formatRussianPlural(7, ELEMENT_FORMS)).toBe("7 элементов");
	});

	it("поддерживает существительные с изменяющейся основой", () => {
		const childForms: RussianPluralForms = {
			one: "ребёнок",
			few: "ребёнка",
			many: "детей"
		};

		expect(formatRussianPlural(5, childForms)).toBe("5 детей");
	});
});

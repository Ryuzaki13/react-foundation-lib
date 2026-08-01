/**
 * Полные формы русского существительного для разных количественных категорий.
 * Полные слова позволяют корректно работать не только с окончаниями, но и с
 * формами, у которых меняется основа, например «ребёнок» и «детей».
 */
export type RussianPluralForms = {
	readonly one: string;
	readonly few: string;
	readonly many: string;
	readonly other?: string;
};

const russianPluralRules = new Intl.PluralRules("ru-RU");

/**
 * Выбирает форму русского существительного по количеству.
 *
 * Категория `other` используется для дробных чисел. Если отдельная форма для
 * неё не передана, применяется форма `few`, например «1,5 элемента».
 */
export function selectRussianPluralForm(value: number, forms: RussianPluralForms): string {
	if (!Number.isFinite(value)) {
		throw new RangeError("Количество должно быть конечным числом.");
	}

	switch (russianPluralRules.select(value)) {
		case "one":
			return forms.one;
		case "few":
			return forms.few;
		case "many":
			return forms.many;
		default:
			return forms.other ?? forms.few;
	}
}

/**
 * Форматирует количество вместе с подходящей формой русского существительного.
 * Число сохраняется без округления; для отдельного форматирования числа следует
 * использовать `selectRussianPluralForm` вместе с нужным числовым форматтером.
 */
export function formatRussianPlural(value: number, forms: RussianPluralForms): string {
	return `${value} ${selectRussianPluralForm(value, forms)}`;
}

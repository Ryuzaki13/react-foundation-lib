import { compareStrings } from "../string-comparison";

import { CollectionItem, CollectionPair } from "./types";

function createEmptySeparated<T extends CollectionItem>(pairs: CollectionPair[]) {
	const resultRef: Record<string, T[]> = {};
	pairs.forEach((pair) => {
		resultRef[pair.codeKey] = [];
	});
	return resultRef;
}

/**
 * Создание разделенных массивов для каждого кодового поля
 * @param items - исходные данные справочника
 * @param pairs - пары код-текст
 * @param excludeEmpty - флаг исключения пустых значений
 * @returns Объект с разделенными массивами по кодовым полям
 */
export function buildSeparatedArrays<T extends CollectionItem>(
	items: T[],
	pairs: CollectionPair[],
	excludeEmpty: boolean = true,
	sortByCode: boolean = true
): Record<string, T[]> {
	// Если items пустой, возвращаем пустые массивы для всех пар
	if (!items || items.length === 0) {
		return createEmptySeparated(pairs);
	}

	// Определяем, какие ключи действительно существуют в items
	const availableKeys = new Set<string>();
	const firstItem = items[0];

	if (firstItem) {
		// Собираем все доступные ключи из первого элемента
		Object.keys(firstItem).forEach((key) => {
			availableKeys.add(key);
		});
	}

	// Фильтруем пары, оставляем только те, где оба ключа существуют в items
	const validPairs = pairs.filter((pair) => {
		return availableKeys.has(pair.codeKey as string) && availableKeys.has(pair.textKey as string);
	});

	// Если нет валидных пар, возвращаем пустой результат
	if (validPairs.length === 0) {
		return createEmptySeparated(pairs);
	}

	const result: Record<string, T[]> = {};
	// Инициализируем структуры данных
	const pairMap = new Map<
		string,
		{
			codeKey: keyof T;
			textKey: keyof T;
			uniqueSet: Set<string>;
		}
	>();

	// Подготовка для валидных пар
	for (const pair of validPairs) {
		const codeKeyStr = pair.codeKey as string;
		pairMap.set(codeKeyStr, {
			codeKey: pair.codeKey,
			textKey: pair.textKey,
			uniqueSet: new Set<string>()
		});
		result[codeKeyStr] = [];
	}

	// Для невалидных пар создаем пустые массивы
	pairs.forEach((pair) => {
		const codeKeyStr = pair.codeKey as string;
		if (!pairMap.has(codeKeyStr)) {
			result[codeKeyStr] = [];
		}
	});

	// Единый проход по всем элементам
	for (const item of items) {
		for (const [codeKeyStr, pairData] of pairMap) {
			const { codeKey, textKey, uniqueSet } = pairData;

			// Получаем значения с проверкой на существование
			const codeValue = String(item[codeKey]);
			const textValue = String(item[textKey]);

			// Если excludeEmpty и текстовое значение пустое - пропускаем
			if (excludeEmpty && !textValue) {
				continue;
			}

			// Проверяем, что codeValue существует
			if (codeValue === undefined || codeValue === null) {
				continue;
			}

			// Проверка уникальности
			const uniqueKey = `${String(codeValue)}|${String(textValue)}`;
			if (!uniqueSet.has(uniqueKey)) {
				uniqueSet.add(uniqueKey);

				// Создаем новый объект только с нужными полями
				result[codeKeyStr].push({
					[codeKey]: codeValue,
					[textKey]: textValue
				} as T);
			}
		}
	}

	// Сортировка результатов для валидных пар
	for (const [codeKeyStr, pairData] of pairMap) {
		const array = result[codeKeyStr];
		if (array.length > 0) {
			const sortKey = sortByCode ? pairData.codeKey : pairData.textKey;

			array.sort((a, b) => {
				const valA = a[sortKey] || "";
				const valB = b[sortKey] || "";
				return compareStrings(String(valA), String(valB));
			});
		}
	}

	return result;

	//

	// pairs.forEach((pair) => {
	// 	let filteredItems = items;

	// 	// Фильтруем пустые значения, если требуется
	// 	if (excludeEmpty) {
	// 		filteredItems = items.filter((item) => item[pair.textKey]);
	// 	}

	// 	// Создаем массив только с нужными полями
	// 	const separatedItems = filteredItems.map(
	// 		(item) =>
	// 			({
	// 				[pair.codeKey]: item[pair.codeKey],
	// 				[pair.textKey]: item[pair.textKey]
	// 			}) as T
	// 	);

	// 	// Удаляем дубликаты
	// 	const uniqueItems: T[] = Array.from(
	// 		new Map(separatedItems.map((item) => [`${item[pair.codeKey]}|${item[pair.textKey]}`, item])).values()
	// 	);

	// 	const sortKey = sortByCode ? pair.codeKey : pair.textKey;

	// 	uniqueItems.sort((a, b) => {
	// 		const textA = a[sortKey] || "";
	// 		const textB = b[sortKey] || "";
	// 		return compareStrings(String(textA), String(textB));
	// 	});

	// 	result[pair.codeKey] = uniqueItems;
	// });

	// return result;
}

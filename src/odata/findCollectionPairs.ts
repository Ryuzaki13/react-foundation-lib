import { CollectionItem, CollectionPair } from "./types";

export function findCollectionPairs(
	item: CollectionItem,
	options: { textSuffixes?: string[]; caseSensitive?: boolean; returnUnpaired?: boolean } = {}
) {
	const { textSuffixes = ["_txt", "_text", "_t", "_Text", "_TXT", "_T"], caseSensitive = false, returnUnpaired = false } = options;

	const fields = Object.keys(item);
	const pairs = [] as CollectionPair[];
	const pairsMap = {} as Record<string, string>;
	const usedFields = new Set();
	const unpairedFields = new Set(fields);

	// Создаем регулярное выражение для поиска текстовых полей
	const suffixPattern = textSuffixes.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
	const textFieldRegex = new RegExp(`(.*)(${suffixPattern})$`, caseSensitive ? "" : "i");

	// Сначала проходим по всем полям и находим текстовые
	const textFields = fields.filter((field) => textFieldRegex.test(field));

	// Для каждого текстового поля ищем соответствующее кодовое
	for (const textField of textFields) {
		if (usedFields.has(textField)) continue;

		const match = textField.match(textFieldRegex);
		if (match) {
			const baseName = match[1]; // Имя без суффикса

			if (fields.includes(baseName) && !usedFields.has(baseName)) {
				pairs.push({
					codeKey: baseName,
					textKey: textField
				});
				pairsMap[baseName] = textField;
				usedFields.add(baseName);
				usedFields.add(textField);
				unpairedFields.delete(baseName);
				unpairedFields.delete(textField);
			}
		}
	}

	const result: { pairs: CollectionPair[]; pairsMap: CollectionItem; unpaired?: string[] } = { pairs, pairsMap };

	if (returnUnpaired) {
		result.unpaired = Array.from(unpairedFields);
	}

	return result;
}

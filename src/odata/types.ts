// type KeyPairs = [code: string, text: string][]; // чётные пары
// type FromPairs<Pairs extends KeyPairs> = {
// 	[K in Pairs[number] as K[0] | K[1]]: string;
// };

// Тип для элементов коллекции
// export type CollectionItem<CodeKey extends string = string, TextKey extends string = string> = {
// 	[K in CodeKey | TextKey]: string;
// };
export type CollectionItem = {
	[K: string]: string;
};

// Тип для конфигурации код-текст пары
export interface CollectionPair {
	codeKey: string;
	textKey: string;
}

// Тип для фильтров зависимостей
export interface DependencyFilter {
	key: string;
	values: CollectionItem[];
}

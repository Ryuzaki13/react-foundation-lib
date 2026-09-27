/** Общая аренда блокировки документа; вложенные потребители освобождают только свою долю. */
export type UseDocumentScrollLockOptions = Readonly<{
	active: boolean;
	/** undefined выбирает глобальный document, null явно отключает DOM-операцию. */
	documentTarget?: Document | null;
	compensateScrollbar?: boolean;
}>;

/** Значения таблицы отделены от исходного DTO: runtime не изменяет снимок Query. */
export type AnalyticalValues = Readonly<Record<string, unknown>>;

export type AnalyticalDataRow<TOriginal = unknown> = Readonly<{
	id: string;
	parentId?: string | null;
	kind?: string;
	original?: TOriginal;
	values: AnalyticalValues;
}>;

/** Готовый полный снимок. Его загрузкой и отменой владеет транспорт потребителя. */
export type AnalyticalSnapshot<TOriginal = unknown> = Readonly<{
	rows: readonly AnalyticalDataRow<TOriginal>[];
}>;

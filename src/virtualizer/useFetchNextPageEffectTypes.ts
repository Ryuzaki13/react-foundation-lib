import { type VirtualItem } from "@tanstack/react-virtual";

/** Дозагрузка не владеет данными и retry: caller передаёт состояние своей пагинации. */
export type UseFetchNextPageEffectOptions = Readonly<{
	virtualItems: readonly VirtualItem[];
	currentItemsCount: number;
	hasNextPage: boolean;
	fetchNextPage: () => Promise<unknown>;
	/** Ошибка передаётся один раз; без callback остаётся явная console-диагностика. */
	onError?: (error: unknown) => void | Promise<void>;
}>;

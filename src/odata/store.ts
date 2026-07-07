// Глобальные конфигурируемые параметры

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

type ODataCollectionState = {
	defaultMaxVisibleItems: number;
	defaultMinSearchTextLength: number;
	defaultMinSearchCodeLength: number;
	defaultSearchDebounceDelay: number;
};

type ODataCollectionActions = {
	setDefaultMaxVisibleItems: (value: number) => void;
	setDefaultMinSearchTextLength: (value: number) => void;
	setDefaultMinSearchCodeLength: (value: number) => void;
	setDefaultSearchDebounceDelay: (value: number) => void;
};

export const useODataCollectionStore = create<ODataCollectionState & ODataCollectionActions>()(
	immer((set) => ({
		defaultMaxVisibleItems: 200,
		defaultMinSearchCodeLength: 3,
		defaultMinSearchTextLength: 1,
		defaultSearchDebounceDelay: 100,

		setDefaultMaxVisibleItems: (defaultMaxVisibleItems) => set({ defaultMaxVisibleItems }),
		setDefaultMinSearchTextLength: (defaultMinSearchTextLength) => set({ defaultMinSearchTextLength }),
		setDefaultMinSearchCodeLength: (defaultMinSearchCodeLength) => set({ defaultMinSearchCodeLength }),
		setDefaultSearchDebounceDelay: (defaultSearchDebounceDelay) => set({ defaultSearchDebounceDelay })
	}))
);

// export const useODataCollectionDefaultMaxVisibleItems = () => useODataCollectionStore((s) => s.defaultMaxVisibleItems);
// export const useODataCollectionDefaultMinSearchCodeLength = () => useODataCollectionStore((s) => s.defaultMinSearchCodeLength);
// export const useODataCollectionDefaultMinSearchTextLength = () => useODataCollectionStore((s) => s.defaultMinSearchTextLength);
// export const useODataCollectionDefaultSearchDebounceDelay = () => useODataCollectionStore((s) => s.defaultSearchDebounceDelay);

export const odataCollectionConfig = {
	useMaxVisibleItems: () => useODataCollectionStore((s) => s.defaultMaxVisibleItems),
	useMinSearchCodeLength: () => useODataCollectionStore((s) => s.defaultMinSearchCodeLength),
	useMinSearchTextLength: () => useODataCollectionStore((s) => s.defaultMinSearchTextLength),
	useSearchDebounce: () => useODataCollectionStore((s) => s.defaultSearchDebounceDelay)
};

import { type VirtualItem } from "@tanstack/react-virtual";

import { useFetchNextPageEffect, type UseFetchNextPageEffectOptions } from "../src/virtualizer";

const mutableItems: VirtualItem[] = [];
const readonlyItems: readonly VirtualItem[] = [];
const legacyOptions = {
	virtualItems: mutableItems,
	currentItemsCount: 10,
	hasNextPage: true,
	fetchNextPage: async () => undefined
} satisfies UseFetchNextPageEffectOptions;
const options = {
	...legacyOptions,
	virtualItems: readonlyItems,
	onError: async (error: unknown) => {
		void error;
	}
} satisfies UseFetchNextPageEffectOptions;
const hook: (options: UseFetchNextPageEffectOptions) => void = useFetchNextPageEffect;
void [hook, legacyOptions, options];

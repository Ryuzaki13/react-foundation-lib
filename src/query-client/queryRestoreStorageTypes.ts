import { type AsyncStorage, type PersistedQuery } from "@tanstack/query-persist-client-core";

import { type QueryRestoredDataParser } from "./queryMeta";

/** Контекст одного restore без владения Query, сессией или предметным parser. */
export type QueryRestoreStorageOptions = Readonly<{
	storage: AsyncStorage<PersistedQuery>;
	queryHash: string;
	prefix: string;
	buster: string;
	maxAge: number;
	parser: QueryRestoredDataParser;
	assertCurrentRestore: () => void;
}>;

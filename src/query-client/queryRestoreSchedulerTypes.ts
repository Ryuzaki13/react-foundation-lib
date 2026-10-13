import { type Query } from "@tanstack/react-query";

/** Контекст scheduled работы одного restore, не новый Query или lifecycle. */
export type QueryRestoreSchedulerGuardOptions = Readonly<{
	query: Query;
	assertCurrentRestore: () => void;
}>;

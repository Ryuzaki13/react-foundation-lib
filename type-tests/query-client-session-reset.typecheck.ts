import { type QueryClient } from "@tanstack/react-query";

import "../src/build-globals";

import {
	installSessionScopedQueryReset,
	installSessionScopedQueryResetLifecycle,
	resetSessionScopedQueries,
	type InstalledSessionScopedQueryResetLifecycle,
	type SessionScopedQueryResetLifecycle,
	type SessionScopedQueryResetOutcome
} from "../src/query-client";

declare const client: QueryClient;

const lifecycle: SessionScopedQueryResetLifecycle = {
	beforeReset: async () => undefined,
	afterReset: (outcome) => {
		const status: "completed" | "failed" = outcome.status;
		void status;
	}
};
const synchronous: SessionScopedQueryResetLifecycle = { beforeReset: () => undefined, afterReset: () => undefined };
const install: (client: QueryClient, lifecycle: SessionScopedQueryResetLifecycle) => InstalledSessionScopedQueryResetLifecycle =
	installSessionScopedQueryResetLifecycle;
const outcome: SessionScopedQueryResetOutcome = { status: "completed" };
const installed = install(client, lifecycle);
const cleanup: () => void = installed.cleanup;

// Прежние вызовы сохраняются; обработчик входящей ошибки остаётся opt-in.
const oldInstallation = installSessionScopedQueryReset(client, { channelName: "session-reset" });
const diagnosticInstallation = installSessionScopedQueryReset(client, {
	channelName: "session-reset-diagnostics",
	onError: async (error: unknown) => {
		void error;
	}
});
const oldReset: Promise<void> = resetSessionScopedQueries(client);
const localReset: Promise<void> = resetSessionScopedQueries(client, { broadcast: false });
void [synchronous, outcome, cleanup, oldInstallation, diagnosticInstallation, oldReset, localReset];

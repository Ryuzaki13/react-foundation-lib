import { type QueryClient } from "@tanstack/react-query";

import {
	type InstalledSessionScopedQueryResetLifecycle,
	type SessionScopedQueryResetLifecycle,
	type SessionScopedQueryResetOutcome
} from "./sessionScopedResetLifecycleTypes";

type SessionScopedQueryResetRegistrationState = {
	registrations: Set<SessionScopedQueryResetLifecycle>;
	activeResets: number;
};

type SessionScopedQueryResetBoundary = Readonly<{
	retirement: Promise<readonly unknown[]> | null;
	complete: (outcome: SessionScopedQueryResetOutcome) => Promise<readonly unknown[]>;
}>;

// WeakMap содержит только subscriptions и число вызовов, а не второй auth/Query snapshot.
const registrationsByClient = new WeakMap<QueryClient, SessionScopedQueryResetRegistrationState>();

function getRegistrationState(queryClient: QueryClient): SessionScopedQueryResetRegistrationState {
	const existing = registrationsByClient.get(queryClient);
	if (existing) return existing;
	const state = { registrations: new Set<SessionScopedQueryResetLifecycle>(), activeResets: 0 };
	registrationsByClient.set(queryClient, state);
	return state;
}

function releaseEmptyRegistrationState(queryClient: QueryClient, state: SessionScopedQueryResetRegistrationState): void {
	if (state.activeResets === 0 && state.registrations.size === 0 && registrationsByClient.get(queryClient) === state) {
		registrationsByClient.delete(queryClient);
	}
}

/**
 * Устанавливать до запуска session-bound runtime на весь срок жизни QueryClient.
 * Поздняя регистрация не может восстановить пропущенный before: вместо частичной
 * защиты она синхронно отклоняется до startup нового consumer.
 */
export function installSessionScopedQueryResetLifecycle(
	queryClient: QueryClient,
	lifecycle: SessionScopedQueryResetLifecycle
): InstalledSessionScopedQueryResetLifecycle {
	const state = getRegistrationState(queryClient);
	if (state.activeResets > 0) throw new Error("Lifecycle session-scoped Query нельзя установить во время сброса");
	const registration = { beforeReset: lifecycle.beforeReset, afterReset: lifecycle.afterReset };
	state.registrations.add(registration);
	let closed = false;
	return {
		cleanup() {
			if (closed) return;
			closed = true;
			state.registrations.delete(registration);
			releaseEmptyRegistrationState(queryClient, state);
		}
	};
}

/** Приватная пара одного reset: перекрывающиеся вызовы не объединяются и не меняют прежний Query flow. */
export function beginSessionScopedQueryReset(queryClient: QueryClient): SessionScopedQueryResetBoundary {
	const state = getRegistrationState(queryClient);
	// Marker публикуется даже без callbacks и раньше любого reentrant before/Query notification.
	state.activeResets += 1;
	const captured = [...state.registrations];
	const retirements = captured.map(({ beforeReset }) => {
		try {
			return Promise.resolve(beforeReset());
		} catch (error) {
			return Promise.reject(error);
		}
	});
	return {
		// Без listeners cancelQueries начинается в прежнем синхронном проходе вызова reset.
		retirement: captured.length === 0 ? null : collectResetCallbackFailures(retirements),
		async complete(outcome) {
			try {
				const completions = captured.map(({ afterReset }) => {
					try {
						return Promise.resolve(afterReset(outcome));
					} catch (error) {
						return Promise.reject(error);
					}
				});
				return await collectResetCallbackFailures(completions);
			} finally {
				state.activeResets -= 1;
				releaseEmptyRegistrationState(queryClient, state);
			}
		}
	};
}

/** Все callbacks завершаются независимо; порядок ошибок совпадает с порядком регистрации. */
async function collectResetCallbackFailures(operations: readonly Promise<void>[]): Promise<readonly unknown[]> {
	const results = await Promise.allSettled(operations);
	return results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
}

import { createStore, type StoreApi } from "zustand";

import { type Notification, type NotificationAction, type NotificationId, type NotificationType } from "./types";

export type NotificationPushInput = {
	id?: NotificationId;
	type: NotificationType;
	title?: string;
	message: string;
	ttlMs?: number;
	dismissible?: boolean;
	actions?: NotificationAction[];
	/** false исключает текст из истории, не меняя отображение и срок жизни активного toast. */
	retainInHistory?: boolean;
};

export type NotificationUpdatePatch = Partial<Omit<Notification, "id" | "createdAt">> & {
	// ttlMs можно менять; createdAt — нет
};

export type NotificationsState = {
	/** Активные toast-уведомления, которые должен отображать краткоживущий host. */
	items: Notification[];
	/** История сохраняемых уведомлений; TTL, dismiss и переполнение toast-стека её не сокращают. */
	history: Notification[];
};

export type NotificationsActions = {
	push: (input: NotificationPushInput) => NotificationId;
	update: (id: NotificationId, patch: NotificationUpdatePatch) => boolean;
	upsert: (input: NotificationPushInput & { id: NotificationId }) => NotificationId;
	dismiss: (id: NotificationId) => void;
	clear: () => void;
	clearHistory: () => void;
};

export type NotificationsStore = NotificationsState & {
	actions: NotificationsActions;
};

const genId = (): NotificationId => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

const MAX_VISIBLE_ITEMS = 6;

export function createNotificationsStore() {
	const timers = new Map<NotificationId, number>();

	const clearTimer = (id: NotificationId) => {
		const t = timers.get(id);
		if (t) {
			window.clearTimeout(t);
			timers.delete(id);
		}
	};

	const armTimer = (store: StoreApi<NotificationsStore>, id: NotificationId, ttlMs: number = 10_000) => {
		clearTimer(id);
		if (ttlMs <= 0) return;

		const t = window.setTimeout(() => {
			store.getState().actions.dismiss(id);
		}, ttlMs);

		timers.set(id, t);
	};

	const store = createStore<NotificationsStore>()((set, get) => ({
		items: [],
		history: [],

		actions: {
			push: (input) => {
				const id = input.id ?? genId();
				const now = Date.now();

				const notif: Notification = {
					id,
					type: input.type,
					title: input.title,
					message: input.message,
					createdAt: now,
					ttlMs: input.ttlMs,
					dismissible: input.dismissible ?? true,
					actions: input.actions,
					// Не добавляем поле старым consumers, если они не задали новую политику.
					...(input.retainInHistory !== undefined ? { retainInHistory: input.retainInHistory } : {})
				};

				const currentItems = get().items;
				const nextItems = [notif, ...currentItems.filter((notification) => notification.id !== id)].slice(0, MAX_VISIBLE_ITEMS);
				const visibleIds = new Set(nextItems.map((notification) => notification.id));

				// Для вытесненного toast таймер больше не нужен; сохранение истории определяется его политикой.
				currentItems.forEach((notification) => {
					if (!visibleIds.has(notification.id)) clearTimer(notification.id);
				});

				set((state) => {
					let history = state.history;

					if (notif.retainInHistory !== false) {
						history = [notif, ...state.history.filter((notification) => notification.id !== id)];
					} else if (state.history.some((notification) => notification.id === id)) {
						history = state.history.filter((notification) => notification.id !== id);
					}

					return { items: nextItems, history };
				});

				armTimer(store, id, notif.ttlMs);
				return id;
			},

			update: (id, patch) => {
				const previous = get().items.find((notification) => notification.id === id);
				if (!previous) return false;

				const { retainInHistory, ...contentPatch } = patch;
				const next: Notification = {
					...previous,
					...contentPatch,
					// undefined, в том числе переданный явно, не отменяет прежний отказ от истории.
					...(retainInHistory !== undefined ? { retainInHistory } : {}),
					id: previous.id,
					createdAt: previous.createdAt
				};

				set((state) => {
					const existsInHistory = state.history.some((notification) => notification.id === id);
					let history = state.history;

					if (next.retainInHistory === false) {
						if (existsInHistory) history = state.history.filter((notification) => notification.id !== id);
					} else if (existsInHistory) {
						history = state.history.map((notification) => (notification.id === id ? next : notification));
					} else if (retainInHistory === true) {
						// После clearHistory вернуть активный toast можно только явным решением consumer.
						history = [next, ...state.history];
					}

					return {
						items: state.items.map((notification) => (notification.id === id ? next : notification)),
						history
					};
				});

				// если ttlMs изменили — пере-армим таймер
				if ("ttlMs" in patch) {
					armTimer(store, id, next.ttlMs);
				}

				return true;
			},

			upsert: (input) => {
				const ok = get().actions.update(input.id, {
					type: input.type,
					title: input.title,
					message: input.message,
					ttlMs: input.ttlMs,
					dismissible: input.dismissible,
					...(input.retainInHistory !== undefined ? { retainInHistory: input.retainInHistory } : {})
				});

				if (ok) return input.id;
				return get().actions.push(input);
			},

			dismiss: (id) => {
				clearTimer(id);
				set((s) => ({ items: s.items.filter((n) => n.id !== id) }));
			},

			clear: () => {
				timers.forEach((t) => window.clearTimeout(t));
				timers.clear();
				set({ items: [] });
			},

			clearHistory: () => {
				set({ history: [] });
			}
		}
	}));

	return store;
}

export type NotificationsStoreApi = StoreApi<NotificationsStore>;

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
};

export type NotificationUpdatePatch = Partial<Omit<Notification, "id" | "createdAt">> & {
	// ttlMs можно менять; createdAt — нет
};

export type NotificationsState = {
	/** Активные toast-уведомления, которые должен отображать краткоживущий host. */
	items: Notification[];
	/** Полная история за время жизни store; TTL, dismiss и переполнение toast-стека её не сокращают. */
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
					actions: input.actions
				};

				const currentItems = get().items;
				const nextItems = [notif, ...currentItems.filter((notification) => notification.id !== id)].slice(0, MAX_VISIBLE_ITEMS);
				const visibleIds = new Set(nextItems.map((notification) => notification.id));

				// Для вытесненного toast таймер больше не нужен: запись уже останется в history.
				currentItems.forEach((notification) => {
					if (!visibleIds.has(notification.id)) clearTimer(notification.id);
				});

				set((state) => ({
					items: nextItems,
					history: [notif, ...state.history.filter((notification) => notification.id !== id)]
				}));

				armTimer(store, id, notif.ttlMs);
				return id;
			},

			update: (id, patch) => {
				const previous = get().items.find((notification) => notification.id === id);
				if (!previous) return false;

				const next: Notification = {
					...previous,
					...patch,
					id: previous.id,
					createdAt: previous.createdAt
				};

				set((state) => ({
					items: state.items.map((notification) => (notification.id === id ? next : notification)),
					history: state.history.map((notification) => (notification.id === id ? next : notification))
				}));

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
					dismissible: input.dismissible
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

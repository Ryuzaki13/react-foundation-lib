import { createStore, StoreApi } from "zustand";

import { Notification, NotificationAction, NotificationId, NotificationType } from "./types";

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

type NotificationsState = {
	items: Notification[];
};

type NotificationsActions = {
	push: (input: NotificationPushInput) => NotificationId;
	update: (id: NotificationId, patch: NotificationUpdatePatch) => boolean;
	upsert: (input: NotificationPushInput & { id: NotificationId }) => NotificationId;
	dismiss: (id: NotificationId) => void;
	clear: () => void;
};

export type NotificationsStore = NotificationsState & {
	actions: NotificationsActions;
};

const genId = (): NotificationId => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

const MAX_ITEMS = 6;

export const createNotificationsStore = () => {
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

				set((s) => ({
					items: [notif, ...s.items.filter((n) => n.id !== id)].slice(0, MAX_ITEMS)
				}));

				armTimer(store, id, notif.ttlMs);
				return id;
			},

			update: (id, patch) => {
				const { items } = get();
				const idx = items.findIndex((n) => n.id === id);
				if (idx === -1) return false;

				const prev = items[idx];
				const next: Notification = {
					...prev,
					...patch,
					id: prev.id,
					createdAt: prev.createdAt
				};

				set((s) => ({
					items: s.items.map((n) => (n.id === id ? next : n))
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
			}
		}
	}));

	return store;
};

export type NotificationsStoreApi = StoreApi<NotificationsStore>;

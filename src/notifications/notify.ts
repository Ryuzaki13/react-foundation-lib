import type { NotificationPushInput, NotificationsStoreApi, NotificationUpdatePatch } from "./store";
import type { NotificationId } from "./types";

let boundStore: NotificationsStoreApi | null = null;

export const bindNotifications = (store: NotificationsStoreApi) => {
	boundStore = store;

	return () => {
		if (boundStore === store) {
			boundStore = null;
		}
	};
};

const requireStore = (): NotificationsStoreApi => {
	if (!boundStore) throw new Error("Notifications store is not bound. Wrap app with NotificationsProvider.");
	return boundStore;
};

export const notify = Object.freeze({
	push: (input: NotificationPushInput) => requireStore().getState().actions.push(input),
	upsert: (input: NotificationPushInput & { id: NotificationId }) => requireStore().getState().actions.upsert(input),
	update: (id: NotificationId, patch: NotificationUpdatePatch) => requireStore().getState().actions.update(id, patch),

	dismiss: (id: NotificationId) => requireStore().getState().actions.dismiss(id),
	clear: () => requireStore().getState().actions.clear(),

	success: (message: string, opts?: Omit<NotificationPushInput, "type" | "message">) =>
		requireStore()
			.getState()
			.actions.push({ type: "success", message, ...opts }),
	info: (message: string, opts?: Omit<NotificationPushInput, "type" | "message">) =>
		requireStore()
			.getState()
			.actions.push({ type: "info", message, ...opts }),
	warning: (message: string, opts?: Omit<NotificationPushInput, "type" | "message">) =>
		requireStore()
			.getState()
			.actions.push({ type: "warning", message, ...opts }),
	error: (message: string, opts?: Omit<NotificationPushInput, "type" | "message">) =>
		requireStore()
			.getState()
			.actions.push({ type: "error", message, ...opts }),

	/**
	 * Удобный паттерн "долгой операции":
	 * const op = notify.progress("Сохраняю...");
	 * ... op.success("Готово") или op.error("Ошибка")
	 */
	progress: (message: string, opts?: { id?: NotificationId; title?: string }) => {
		const store = requireStore();
		const id = opts?.id;

		if (id) {
			store.getState().actions.upsert({
				id,
				type: "info",
				title: opts?.title,
				message,
				dismissible: false
			});
		}

		const notificationId =
			id ??
			store.getState().actions.push({
				type: "info",
				title: opts?.title,
				message,
				dismissible: false
			});

		return {
			id: notificationId,
			update: (nextMessage: string) => notify.update(notificationId, { message: nextMessage }),
			success: (nextMessage: string, ttlMs = 2500) =>
				notify.update(notificationId, { type: "success", message: nextMessage, dismissible: true, ttlMs }),
			error: (nextMessage: string, ttlMs = 5000) =>
				notify.update(notificationId, { type: "error", message: nextMessage, dismissible: true, ttlMs }),
			dismiss: () => notify.dismiss(notificationId)
		};
	}
});

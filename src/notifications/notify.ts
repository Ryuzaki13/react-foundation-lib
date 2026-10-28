import {
	NOTIFICATION_TYPE_ERROR,
	NOTIFICATION_TYPE_INFO,
	NOTIFICATION_TYPE_SUCCESS,
	NOTIFICATION_TYPE_WARNING
} from "./notificationTypeConstants";
import { type NotificationPushInput, type NotificationsStoreApi, type NotificationUpdatePatch } from "./store";
import { type NotificationId } from "./types";

let boundStore: NotificationsStoreApi | null = null;

const PROGRESS_SUCCESS_TTL_MS = 2_500;
const PROGRESS_ERROR_TTL_MS = 5_000;

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
	clearHistory: () => requireStore().getState().actions.clearHistory(),

	success: (message: string, opts?: Omit<NotificationPushInput, "type" | "message">) =>
		requireStore()
			.getState()
			.actions.push({ type: NOTIFICATION_TYPE_SUCCESS, message, ...opts }),
	info: (message: string, opts?: Omit<NotificationPushInput, "type" | "message">) =>
		requireStore()
			.getState()
			.actions.push({ type: NOTIFICATION_TYPE_INFO, message, ...opts }),
	warning: (message: string, opts?: Omit<NotificationPushInput, "type" | "message">) =>
		requireStore()
			.getState()
			.actions.push({ type: NOTIFICATION_TYPE_WARNING, message, ...opts }),
	error: (message: string, opts?: Omit<NotificationPushInput, "type" | "message">) =>
		requireStore()
			.getState()
			.actions.push({ type: NOTIFICATION_TYPE_ERROR, message, ...opts }),

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
				type: NOTIFICATION_TYPE_INFO,
				title: opts?.title,
				message,
				dismissible: false
			});
		}

		const notificationId =
			id ??
			store.getState().actions.push({
				type: NOTIFICATION_TYPE_INFO,
				title: opts?.title,
				message,
				dismissible: false
			});

		return {
			id: notificationId,
			update: (nextMessage: string) => notify.update(notificationId, { message: nextMessage }),
			success: (nextMessage: string, ttlMs = PROGRESS_SUCCESS_TTL_MS) =>
				notify.update(notificationId, { type: NOTIFICATION_TYPE_SUCCESS, message: nextMessage, dismissible: true, ttlMs }),
			error: (nextMessage: string, ttlMs = PROGRESS_ERROR_TTL_MS) =>
				notify.update(notificationId, { type: NOTIFICATION_TYPE_ERROR, message: nextMessage, dismissible: true, ttlMs }),
			dismiss: () => notify.dismiss(notificationId)
		};
	}
});

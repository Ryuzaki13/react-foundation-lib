import {
	type NOTIFICATION_TYPE_ERROR,
	type NOTIFICATION_TYPE_INFO,
	type NOTIFICATION_TYPE_SUCCESS,
	type NOTIFICATION_TYPE_WARNING
} from "./notificationTypeConstants";

export type NotificationType =
	typeof NOTIFICATION_TYPE_ERROR | typeof NOTIFICATION_TYPE_WARNING | typeof NOTIFICATION_TYPE_INFO | typeof NOTIFICATION_TYPE_SUCCESS;

export type NotificationTone = "neutral" | NotificationType;

export type NotificationId = string;

export type NotificationAction = {
	label: string;
	onClick: () => void | Promise<void>;
	tone?: NotificationTone;
};

export type Notification = {
	id: NotificationId;
	type: NotificationType;
	title?: string;
	message: string;
	createdAt: number;
	ttlMs?: number;
	dismissible?: boolean;
	actions?: NotificationAction[];
	/** false оставляет текст только в активном toast; отсутствие поля сохраняет прежнее включение в историю. */
	retainInHistory?: boolean;
};

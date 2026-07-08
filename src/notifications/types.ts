export type NotificationType = "error" | "warning" | "info" | "success";

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
};

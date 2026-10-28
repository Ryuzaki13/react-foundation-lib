import { type BROWSER_NOTIFICATION_UNSUPPORTED } from "./browserNotificationConstants";

/** Состояние системного разрешения; unsupported не подменяется отказом пользователя. */
export type BrowserNotificationPermission = NotificationPermission | typeof BROWSER_NOTIFICATION_UNSUPPORTED;

export type BrowserNotificationRequest = Readonly<{
	title: string;
	body: string;
	tag: string;
	icon?: string;
	/** Только same-origin URL; service worker приложения обрабатывает notificationclick. */
	url: string;
}>;

export type BrowserNotificationPresenter = Readonly<{
	permission: () => BrowserNotificationPermission;
	/** Вызывать непосредственно из пользовательского события, а не из effect. */
	requestPermission: () => Promise<BrowserNotificationPermission>;
	/** Disposer действует сразу, включая незавершённый showNotification. */
	show: (request: BrowserNotificationRequest) => () => void;
	dispose: () => void;
}>;

export type BrowserNotificationPresenterOptions = Readonly<{
	onOpen: (url: string) => void;
	onError: (error: unknown) => void;
}>;

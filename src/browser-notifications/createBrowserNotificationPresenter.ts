import { uuidv4 } from "../crypto/uuid";
import { isRecord } from "../validators/isRecord";

import { BROWSER_NOTIFICATION_UNSUPPORTED } from "./browserNotificationConstants";
import {
	type BrowserNotificationPermission,
	type BrowserNotificationPresenter,
	type BrowserNotificationPresenterOptions
} from "./browserNotificationTypes";

const NOTIFICATION_PERMISSION_GRANTED = "granted";

/**
 * Без I/O до команды. Предпочитает действующий SW для мобильных браузеров,
 * но не регистрирует новый worker и не ожидает бесконечно navigator.ready.
 */
export function createBrowserNotificationPresenter({ onOpen, onError }: BrowserNotificationPresenterOptions): BrowserNotificationPresenter {
	const releases = new Set<() => void>();
	let disposed = false;
	const permission = (): BrowserNotificationPermission =>
		typeof window !== "undefined" && window.isSecureContext && typeof Notification !== "undefined"
			? Notification.permission
			: BROWSER_NOTIFICATION_UNSUPPORTED;
	return {
		permission,
		async requestPermission() {
			const current = permission();
			if (disposed || current !== "default") return current;
			try {
				return await Notification.requestPermission();
			} catch (error: unknown) {
				onError(error);
				return permission();
			}
		},
		show(request) {
			if (disposed || permission() !== NOTIFICATION_PERMISSION_GRANTED) return () => undefined;
			const url = new URL(request.url, window.location.href);
			if (url.origin !== window.location.origin) throw new Error("URL уведомления должен принадлежать текущему origin.");
			let released = false;
			const publicationId = uuidv4();
			let close = () => undefined as void;
			const release = () => {
				if (released) return;
				released = true;
				releases.delete(release);
				close();
			};
			releases.add(release);
			const deliver = async () => {
				const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
				if (released || disposed || permission() !== NOTIFICATION_PERMISSION_GRANTED) return;
				const options: NotificationOptions = {
					body: request.body,
					tag: request.tag,
					icon: request.icon,
					data: { url: url.href, publicationId },
					// Звуком управляет вызывающий сценарий; ОС не должна удваивать собственный сигнал.
					silent: true
				};
				if (registration?.active) {
					await registration.showNotification(request.title, options);
					const notifications = (await registration.getNotifications({ tag: request.tag })).filter(
						(notification) => isRecord(notification.data) && notification.data.publicationId === publicationId
					);
					close = () => {
						for (const notification of notifications) notification.close();
					};
					if (released || disposed) close();
					return;
				}
				const notification = new Notification(request.title, options);
				close = () => notification.close();
				notification.addEventListener("click", () => {
					if (released || disposed) return;
					release();
					window.focus();
					onOpen(url.href);
				});
				notification.addEventListener("error", () => {
					if (!released && !disposed) onError(new Error("Браузер не смог показать системное уведомление."));
				});
			};
			void deliver().catch((error: unknown) => {
				if (!released && !disposed) onError(error);
				release();
			});
			return release;
		},
		dispose() {
			disposed = true;
			for (const release of [...releases]) release();
		}
	};
}

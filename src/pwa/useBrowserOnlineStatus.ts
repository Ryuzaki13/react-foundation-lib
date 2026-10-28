import { useSyncExternalStore } from "react";

const ONLINE_EVENT = "online";
const OFFLINE_EVENT = "offline";

function subscribe(onStoreChange: () => void) {
	window.addEventListener(ONLINE_EVENT, onStoreChange);
	window.addEventListener(OFFLINE_EVENT, onStoreChange);
	return () => {
		window.removeEventListener(ONLINE_EVENT, onStoreChange);
		window.removeEventListener(OFFLINE_EVENT, onStoreChange);
	};
}

function getSnapshot() {
	return navigator.onLine;
}

function getServerSnapshot() {
	return true;
}

/** Наблюдает browser online hint без попытки подменить им проверку доступности конкретного сервера. */
export function useBrowserOnlineStatus() {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

import { useSyncExternalStore } from "react";

function subscribe(onStoreChange: () => void) {
	window.addEventListener("online", onStoreChange);
	window.addEventListener("offline", onStoreChange);
	return () => {
		window.removeEventListener("online", onStoreChange);
		window.removeEventListener("offline", onStoreChange);
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

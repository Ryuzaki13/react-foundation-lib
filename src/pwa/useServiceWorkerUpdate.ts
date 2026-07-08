import { useCallback, useEffect, useState } from "react";

import {
	applyServiceWorkerUpdate,
	canAutoApplyServiceWorkerUpdate,
	checkServiceWorkerUpdate,
	clearServiceWorkerUpdateReloadChain,
	hasWaitingServiceWorker,
	registerServiceWorker,
	reloadPageForServiceWorkerUpdate,
	unsubscribeServiceWorkerUpdate
} from "./serviceWorker";

// TODO: Vite env
const SW_UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
// TODO: Vite env
const SW_STARTUP_AUTO_UPDATE_GRACE_MS = 30 * 1000;

function isStartupNavigationForAutoUpdate(): boolean {
	const [entry] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];

	/**
	 * reload — пользователь явно обновил страницу.
	 * navigate — пользователь открыл страницу по ссылке/закладке.
	 */
	return entry?.type === "reload" || entry?.type === "navigate";
}

export function useServiceWorkerUpdate() {
	const [waitingRegistration, setWaitingRegistration] = useState<ServiceWorkerRegistration | null>(null);

	const hasUpdate = waitingRegistration !== null;

	const applyUpdate = useCallback(() => {
		if (applyServiceWorkerUpdate(waitingRegistration)) return true;
		if (!waitingRegistration) return false;

		/**
		 * Если другой клиент уже активировал waiting worker, в текущей вкладке
		 * registration.waiting станет пустым, но баннер ещё может быть видимым.
		 */
		return reloadPageForServiceWorkerUpdate();
	}, [waitingRegistration]);

	const dismiss = useCallback(() => {
		setWaitingRegistration(null);
	}, []);

	useEffect(() => {
		if (__DEV__) return;

		let isActive = true;
		const startupStartedAt = Date.now();
		let startupResetTimerId: number | null = null;
		let startupUpdateApplied = false;

		const canApplyStartupUpdate = () =>
			isStartupNavigationForAutoUpdate() &&
			Date.now() - startupStartedAt <= SW_STARTUP_AUTO_UPDATE_GRACE_MS &&
			canAutoApplyServiceWorkerUpdate();

		const tryApplyStartupUpdate = (reg: ServiceWorkerRegistration) => {
			if (startupUpdateApplied) return true;
			if (!canApplyStartupUpdate()) return false;

			const applied = applyServiceWorkerUpdate(reg);
			startupUpdateApplied = applied;

			return applied;
		};

		const scheduleStartupChainReset = () => {
			const elapsedMs = Date.now() - startupStartedAt;
			const timeoutMs = Math.max(SW_STARTUP_AUTO_UPDATE_GRACE_MS - elapsedMs, 0);

			startupResetTimerId = window.setTimeout(() => {
				if (!isActive) return;

				clearServiceWorkerUpdateReloadChain();
			}, timeoutMs);
		};

		const handleUpdate = (reg: ServiceWorkerRegistration) => {
			if (!isActive) return;

			/**
			 * Если update найден вскоре после reload/navigate, применяем его
			 * автоматически. Это закрывает цепочку из нескольких деплоев,
			 * накопленных во время простоя вкладки.
			 */
			if (tryApplyStartupUpdate(reg)) {
				return;
			}

			/**
			 * Если update найден уже во время активной сессии —
			 * показываем баннер.
			 */
			setWaitingRegistration(reg);
		};

		async function init() {
			const reg = await registerServiceWorker({
				onUpdate: handleUpdate
			});

			if (!isActive) return;

			/**
			 * Важный сценарий:
			 * пользователь перезагрузил страницу, а новый SW уже был в waiting.
			 * В этом случае не показываем баннер, а применяем update сразу.
			 */
			if (hasWaitingServiceWorker(reg) && tryApplyStartupUpdate(reg)) {
				return;
			}

			const checkedReg = await checkServiceWorkerUpdate();

			if (!isActive) return;
			if (startupUpdateApplied) return;

			if (hasWaitingServiceWorker(checkedReg) && tryApplyStartupUpdate(checkedReg)) {
				return;
			}

			if (hasWaitingServiceWorker(checkedReg)) {
				setWaitingRegistration(checkedReg);
			}

			scheduleStartupChainReset();
		}

		void init();

		const intervalId = window.setInterval(() => {
			void checkServiceWorkerUpdate().then((reg) => {
				if (!isActive) return;

				if (hasWaitingServiceWorker(reg)) {
					setWaitingRegistration(reg);
				}
			});
		}, SW_UPDATE_CHECK_INTERVAL_MS);

		return () => {
			isActive = false;
			if (startupResetTimerId !== null) {
				window.clearTimeout(startupResetTimerId);
			}
			window.clearInterval(intervalId);
			unsubscribeServiceWorkerUpdate(handleUpdate);
		};
	}, []);

	return {
		hasUpdate,
		applyUpdate,
		dismiss
	};
}

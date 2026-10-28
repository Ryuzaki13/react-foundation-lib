import { useEffect, useState } from "react";

import { DOM_RESIZE_EVENT } from "./domEventConstants";

export const useIsTouchDevice = () => {
	const [isTouchDevice, setIsTouchDevice] = useState(false);

	useEffect(() => {
		const checkTouchDevice = () => {
			const isTouch = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window || navigator.maxTouchPoints > 0;
			setIsTouchDevice(isTouch);
		};

		checkTouchDevice();

		// Обработчик для изменений в типе устройства
		window.addEventListener(DOM_RESIZE_EVENT, checkTouchDevice);

		return () => {
			window.removeEventListener(DOM_RESIZE_EVENT, checkTouchDevice);
		};
	}, []);

	return isTouchDevice;
};

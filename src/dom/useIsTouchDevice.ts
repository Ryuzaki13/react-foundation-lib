import { useEffect, useState } from "react";

export const useIsTouchDevice = () => {
	const [isTouchDevice, setIsTouchDevice] = useState(false);

	useEffect(() => {
		const checkTouchDevice = () => {
			const isTouch = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window || navigator.maxTouchPoints > 0;
			setIsTouchDevice(isTouch);
		};

		checkTouchDevice();

		// Обработчик для изменений в типе устройства
		window.addEventListener("resize", checkTouchDevice);

		return () => {
			window.removeEventListener("resize", checkTouchDevice);
		};
	}, []);

	return isTouchDevice;
};

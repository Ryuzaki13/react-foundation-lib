/**
 * Проверяет корректность URL
 * @param url - проверяемый URL
 * @returns объект с результатом валидации
 */
export const validateUrl = (url: string) => {
	if (!url) {
		return {
			isValid: false,
			error: "URL не может быть пустым"
		};
	}

	try {
		// Добавляем протокол, если его нет
		const urlToCheck = url.startsWith("http") ? url : `https://${url}`;
		new URL(urlToCheck);

		// Дополнительные проверки
		if (url.length > 2048) {
			return {
				isValid: false,
				error: "URL слишком длинный"
			};
		}

		// Проверка на допустимые символы
		const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
		if (!urlPattern.test(url)) {
			return {
				isValid: false,
				error: "URL содержит недопустимые символы"
			};
		}

		return {
			isValid: true,
			error: ""
		};
	} catch {
		return {
			isValid: false,
			error: "Некорректный формат URL"
		};
	}
};

/**
 * Форматирует ФИО в формат "Фамилия Имя Отчество"
 * @param fullName Входная строка с ФИО в любом формате
 * @returns Отформатированная строка в формате "Иванов Иван Иванович"
 */
export function formatFullName(fullName: string): string {
	if (!fullName) return "";

	// Нормализация строки: удаление лишних пробелов, приведение к нижнему регистру
	const normalized = fullName
		.trim()
		.replace(/\s+/g, " ")
		.replace(/\s*\./, " ") // если после фамилии есть точка...
		.replace(/\s*\.\s*/g, ". ")
		.toLowerCase();

	// Разделение на части
	const parts = normalized.split(" ");

	if (parts.length === 0) return "";

	// Обработка фамилии (первая часть)
	const surname = capitalize(parts[0]);

	if (parts.length === 1) return surname;

	// Обработка имени (вторая часть)
	const name = parts[1].includes(".") ? expandInitial(parts[1]) : capitalize(parts[1]);

	if (parts.length === 2) return `${surname} ${name}`;

	// Обработка отчества (третья часть)
	const patronymic = parts[2].includes(".") ? expandInitial(parts[2]) : capitalize(parts[2]);

	return `${surname} ${name} ${patronymic}`;
}

/**
 * Форматирует ФИО в формат "Фамилия И.О."
 * @param fullName Входная строка с ФИО в любом формате
 * @returns Отформатированная строка в формате "Иванов И.И."
 */
export function formatShortName(fullName: string): string {
	if (!fullName) return "";

	// Нормализация строки
	const normalized = fullName
		.trim()
		.replace(/\s+/g, " ")
		.replace(/\s*\.\s*/g, ".")
		.toLowerCase();

	const parts = normalized.split(" ");

	if (parts.length === 0) return "";

	// Фамилия всегда с большой буквы
	const surname = capitalize(parts[0]);

	if (parts.length === 1) return surname;

	// Инициал имени
	const nameInitial = parts[1].startsWith(".") ? parts[1][1] : parts[1][0];

	if (parts.length === 2) {
		return parts[1].includes(".") ? `${surname} ${nameInitial.toUpperCase()}.` : `${surname} ${nameInitial.toUpperCase()}.`;
	}

	// Инициал отчества
	const patronymicInitial = parts[2].startsWith(".") ? parts[2][1] : parts[2][0];

	return `${surname} ${nameInitial.toUpperCase()}.${patronymicInitial.toUpperCase()}.`;
}

function capitalize(str: string): string {
	if (!str) return "";
	return str[0].toUpperCase() + str.slice(1);
}

function expandInitial(initial: string): string {
	return capitalize(initial);

	// if (!initial.includes(".")) return capitalize(initial);

	// const letter = initial.replace(/\./g, "").toLowerCase();
	// if (!letter) return "";

	// return letter.toUpperCase();
}

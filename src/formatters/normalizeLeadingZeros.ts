import { toFiniteNumber } from "./number";
import { stripInnerSpaces } from "./strings";

/**
 * Нормализует ведущие нули у числового значения.
 *
 * Правило fixed:
 * - fixed === 0 / undefined / NaN / не finite -> ничего не делает, возвращает исходное значение
 * - fixed  < 0 -> удаляет ведущие нули (только в целой части)
 * - fixed  > 0 -> дополняет целую часть ведущими нулями до длины fixed
 *
 * Если value не является числом и не парсится в число — возвращается как есть.
 * Возвращаемый тип: если вход number -> number, если вход string -> string, иначе unknown.
 */
export function normalizeLeadingZeros(value: unknown, fixed?: number): unknown {
	const n = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(n)) return value;

	// Работаем со строкой числа, но pad применяем только к целой части
	const raw = String(n); // "-12.3" | "12" | "0.5"

	if (typeof fixed === "number" && fixed > 0) {
		let i = 0;
		let sign = "";

		const c0 = raw.charCodeAt(0);
		if (c0 === 45 /*-*/ || c0 === 43 /*+*/) {
			sign = raw[0];
			i = 1;
		}

		// отделяем дробь
		const dot = raw.indexOf(".", i);
		const intEnd = dot === -1 ? raw.length : dot;

		let intPart = raw.slice(i, intEnd);
		const fracPart = dot === -1 ? "" : raw.slice(dot); // включая '.'

		// ".5" -> "0.5" не бывает у String(number), но на всякий случай:
		if (!intPart) intPart = "0";

		const len = intPart.length;
		if (len < fixed) {
			intPart = "0".repeat(fixed - len) + intPart;
		}

		return sign + intPart + fracPart;
	}

	return raw;
}

/**
 * Нормализует ведущие нули у числового значения.
 *
 * Использовать только если значения могут иметь нестандартное форматирование, например разделители групп и тд.
 *
 * Правило fixed:
 * - fixed === 0 / undefined / NaN / не finite -> ничего не делает, возвращает исходное значение
 * - fixed  < 0 -> удаляет ведущие нули (только в целой части)
 * - fixed  > 0 -> дополняет целую часть ведущими нулями до длины fixed
 *
 * Если value не является числом и не парсится в число — возвращается как есть.
 * Возвращаемый тип: если вход number -> number, если вход string -> string, иначе unknown.
 */
export function normalizeLeadingZerosStrict<T>(value: T, fixed?: number): T {
	// fixed не задан / 0 / не число / бесконечность => no-op
	if (!fixed || !Number.isFinite(fixed)) return value;

	// Быстрый путь для number
	if (typeof value === "number") {
		if (!Number.isFinite(value)) return value;

		// Для number делаем преобразование через строку.
		// Важно: у number ведущих нулей в обычном представлении нет,
		// поэтому fixed < 0 по факту ничего не меняет.
		const out = normalizeStringNumber(String(value), fixed);
		// Пытаемся вернуть number обратно, чтобы не ломать типы/ожидания.
		const n = Number(out);
		return Number.isFinite(n) ? (n as unknown as T) : value;
	}

	// Основной путь для строк
	if (typeof value === "string") {
		// Быстрая проверка «похоже ли на число»: если вообще нет цифр — не парсим.
		// (Чуть ускоряет кейсы с произвольными строками).
		let hasDigit = false;
		for (let i = 0; i < value.length; i++) {
			const c = value.charCodeAt(i);
			if (c >= 48 && c <= 57) {
				hasDigit = true;
				break;
			}
		}
		if (!hasDigit) return value;

		// Проверка, что строка реально парсится в число.
		// Поддержка "SAP-like": пробелы и NBSP как группировка, ',' как десятичный.
		const parsed = toFiniteNumber(value);
		if (parsed === undefined) return value;

		const out = normalizeStringNumber(value, fixed);
		return out as unknown as T;
	}

	// Для остальных типов — не трогаем
	return value;
}

/**
 * Нормализация для строкового представления числа.
 * Работает только с целой частью (до '.' или ',').
 */
function normalizeStringNumber(input: string, fixed: number): string {
	const s = input.trim();
	if (!s) return input;

	// Знак
	let i = 0;
	let sign = "";
	const first = s.charCodeAt(0);
	if (first === 45 /* - */ || first === 43 /* + */) {
		sign = s[0];
		i = 1;
	}

	// Найдём позицию десятичного разделителя ('.' или ',') — берём первый найденный.
	// Нули нормализуем только в целой части.
	let dot = -1;
	for (let k = i; k < s.length; k++) {
		const ch = s.charCodeAt(k);
		if (ch === 46 /* . */ || ch === 44 /* , */) {
			dot = k;
			break;
		}
	}

	const intEnd = dot === -1 ? s.length : dot;
	const frac = dot === -1 ? "" : s.slice(dot); // включая разделитель и дробную часть

	// Выделим целую часть (без знака)
	let intPart = s.slice(i, intEnd);

	// Уберём пробелы/неразрывные пробелы внутри (SAP-like grouping), чтобы не мешали.
	// Делается без regex, чтобы быть дешевле при массовых вызовах.
	intPart = stripInnerSpaces(intPart);

	// Если целая часть пустая (".5") — считаем как "0"
	if (intPart.length === 0) intPart = "0";

	const target = fixed | 0; // быстрый int
	if (target <= 0) {
		// Trim leading zeros
		let p = 0;
		while (p < intPart.length && intPart.charCodeAt(p) === 48 /* '0' */) p++;

		// Если всё было нулями — оставляем один ноль
		intPart = p === intPart.length ? "0" : intPart.slice(p);
	} else {
		if (target > 0) {
			const len = intPart.length;
			if (len < target) {
				// Быстрое дополняние без padStart (чуть меньше накладных расходов)
				intPart = "0".repeat(target - len) + intPart;
			}
		}
	}

	return sign + intPart + frac;
}

import { SPACE_CODE, NO_BREAK_SPACE_CODE, NARROW_NO_BREAK_SPACE_CODE } from "./spaceCharacterConstants";

/**
 * Удаляет пробелы и NBSP/узкие NBSP внутри строки.
 * (для случая "1 234" или "1\u00A0234").
 */
export function stripInnerSpaces(s: string): string {
	let out = "";
	let changed = false;

	for (let i = 0; i < s.length; i++) {
		const c = s.charCodeAt(i);
		// обычный пробел, NBSP, NNBSP
		if (c === SPACE_CODE || c === NO_BREAK_SPACE_CODE || c === NARROW_NO_BREAK_SPACE_CODE) {
			changed = true;
			continue;
		}
		out += s[i];
	}

	return changed ? out : s;
}

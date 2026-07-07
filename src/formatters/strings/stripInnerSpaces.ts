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
		if (c === 32 || c === 160 || c === 8239) {
			changed = true;
			continue;
		}
		out += s[i];
	}

	return changed ? out : s;
}

export type ToggleClassName = Record<string, boolean | undefined>;
export type PureClassName = string | boolean | undefined | null;
type ClassNameArg = PureClassName | ToggleClassName;

export function cn(...args: ClassNameArg[]): string;
export function cn(): string {
	let out = "";

	for (let i = 0; i < arguments.length; i++) {
		const v = arguments[i] as ClassNameArg;

		if (!v || v === true) continue;

		if (typeof v === "string") {
			out = out ? out + " " + v : v;
			continue;
		}

		if (typeof v !== "object" || Array.isArray(v)) continue;

		for (const k in v) {
			if (v[k]) {
				out = out ? out + " " + k : k;
			}
		}
	}

	return out;
}

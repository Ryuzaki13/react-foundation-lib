import { Breakpoint } from "./breakpoints";

export type ResponsiveMap<T> = {
	mobile?: T;
	tablet?: T;
	laptop?: T;
};
export type ResponsiveValue<T> = T | ResponsiveMap<T>;
export type UnwrapResponsive<T> = T extends ResponsiveValue<infer U> ? U : T;

export function isResponsiveMap<T>(v: ResponsiveValue<T>): v is ResponsiveMap<T> {
	if (typeof v !== "object" || v === null) return false;

	// ключевой момент: отличаем “responsive-map” от произвольного объекта T
	return "mobile" in v || "tablet" in v || "laptop" in v || "desktop" in v;
}

/**
 * Превращает объект пропсов, где некоторые поля ResponsiveValue<...>,
 * в объект, где эти поля уже "плоские" (U).
 */
export type ResolvedProps<T extends object> = {
	[K in keyof T]: UnwrapResponsive<T[K]>;
};

/**
 * Резолвит responsive значение под текущий брейкпоинт.
 * Приоритеты:
 * - exact match (mobile/tablet/laptop)
 * - fallback на "первое определённое" в предсказуемом порядке
 */
export function resolveResponsiveValue<T>(value: ResponsiveValue<T> | undefined, bp: Breakpoint): T | undefined {
	if (value === undefined) return undefined;
	if (!isResponsiveMap(value)) {
		// здесь value точно T (в т.ч. может быть объектом — и это ок)
		return value;
	}

	if (bp === "mobile") return value.mobile ?? value.tablet ?? value.laptop;
	if (bp === "tablet") return value.tablet ?? value.mobile ?? value.laptop;

	return value.laptop ?? value.tablet ?? value.mobile;
}

/**
 * Типобезопасно резолвит все поля объекта по списку ключей, которые responsive.
 * (TS-магия: на выходе будет ResolvedProps<T>.)
 */
export function resolveProps<T extends object>(props: T, bp: Breakpoint, responsiveKeys: readonly (keyof T)[]): ResolvedProps<T> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const out: any = { ...props };

	for (const key of responsiveKeys) {
		out[key] = resolveResponsiveValue(out[key], bp);
	}

	return out as ResolvedProps<T>;
}

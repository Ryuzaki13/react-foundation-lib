export function logError(...args: unknown[]) {
	// косвенный вызов, terser не удалит
	globalThis.console.error(...args);
}

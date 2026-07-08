type ContextErrorMessageOptions = {
	hookName: string;
	providerName: string;
	contextName?: string;
};

export function createMissingContextErrorMessage({ hookName, providerName, contextName }: ContextErrorMessageOptions): string {
	const contextPart = contextName ? ` "${contextName}"` : "";

	return [
		`Хук ${hookName} должен использоваться внутри ${providerName}.`,
		`Контекст${contextPart} равен null, поэтому, вероятно, дерево компонентов не обёрнуто в ${providerName}.`,
		`Убедитесь, что ${providerName} расположен выше компонента, который вызывает ${hookName}.`
	].join(" ");
}

type MissingContextErrorOptions = {
	hookName: string;
	providerName: string;
	contextName?: string;
};

export function createMissingContextError({ hookName, providerName, contextName }: MissingContextErrorOptions): Error {
	return new Error(
		createMissingContextErrorMessage({
			hookName,
			providerName,
			contextName
		})
	);
}

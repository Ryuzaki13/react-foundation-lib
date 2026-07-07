type FormErrorLike = {
	readonly message?: unknown;
};

function readFormErrorMessage(error: unknown): string | undefined {
	if (typeof error === "string") {
		return error;
	}

	if (Array.isArray(error)) {
		return readFirstFormError(error);
	}

	if (typeof error === "object" && error !== null) {
		const maybeError = error as FormErrorLike;

		if (typeof maybeError.message === "string" && maybeError.message.length > 0) {
			return maybeError.message;
		}
	}

	return undefined;
}

export function readFirstFormError(errors: readonly unknown[] | undefined): string | undefined {
	if (!errors) {
		return undefined;
	}

	for (const error of errors) {
		const message = readFormErrorMessage(error);

		if (message) {
			return message;
		}
	}

	return undefined;
}

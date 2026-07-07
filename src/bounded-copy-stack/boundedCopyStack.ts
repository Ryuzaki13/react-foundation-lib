export const DEFAULT_BOUNDED_COPY_STACK_SIZE = 3;

export type BoundedCopyStackItem<TPayload, TMeta = undefined> = {
	id: string;
	fingerprint: string;
	payload: TPayload;
	meta: TMeta;
	copiedAt: number;
};

export type BoundedCopyStackPushInput<TPayload, TMeta = undefined> = {
	id: string;
	fingerprint: string;
	payload: TPayload;
	meta: TMeta;
	copiedAt?: number;
};

export type BoundedCopyStackOptions = {
	maxSize?: number;
};

export type BoundedCopyStackPushResult<TPayload, TMeta = undefined> = {
	items: BoundedCopyStackItem<TPayload, TMeta>[];
	addedItem: BoundedCopyStackItem<TPayload, TMeta>;
	updatedExisting: boolean;
};

function normalizeMaxSize(value: number | undefined): number {
	if (!Number.isFinite(value)) return DEFAULT_BOUNDED_COPY_STACK_SIZE;
	return Math.max(1, Math.trunc(value ?? DEFAULT_BOUNDED_COPY_STACK_SIZE));
}

export function pushBoundedCopyStackItem<TPayload, TMeta = undefined>(
	items: readonly BoundedCopyStackItem<TPayload, TMeta>[],
	input: BoundedCopyStackPushInput<TPayload, TMeta>,
	options: BoundedCopyStackOptions = {}
): BoundedCopyStackPushResult<TPayload, TMeta> {
	const copiedAt = input.copiedAt ?? Date.now();
	const nextItem: BoundedCopyStackItem<TPayload, TMeta> = {
		id: input.id,
		fingerprint: input.fingerprint,
		payload: input.payload,
		meta: input.meta,
		copiedAt
	};
	const existingIndex = items.findIndex((item) => item.fingerprint === input.fingerprint);
	const withoutDuplicate = existingIndex >= 0 ? items.filter((item) => item.fingerprint !== input.fingerprint) : items;
	const maxSize = normalizeMaxSize(options.maxSize);

	return {
		items: [nextItem, ...withoutDuplicate].slice(0, maxSize),
		addedItem: nextItem,
		updatedExisting: existingIndex >= 0
	};
}

export function getBoundedCopyStackCandidates<TPayload, TMeta = undefined>(
	items: readonly BoundedCopyStackItem<TPayload, TMeta>[],
	predicate: (item: BoundedCopyStackItem<TPayload, TMeta>) => boolean
): BoundedCopyStackItem<TPayload, TMeta>[] {
	return items.filter(predicate);
}

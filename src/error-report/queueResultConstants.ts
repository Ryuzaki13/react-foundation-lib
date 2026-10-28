/** Значения durable queue разделяются producer, parser и публичными типами результата. */
export const QUEUE_FAILURE_HTTP = "http" as const;
export const QUEUE_FAILURE_NETWORK = "network" as const;
export const QUEUE_FAILURE_TIMEOUT = "timeout" as const;
export const QUEUE_FAILURE_UNKNOWN = "unknown" as const;
export const QUEUE_ENQUEUE_ACCEPTED = "enqueued" as const;
export const QUEUE_ENQUEUE_DUPLICATE = "duplicate" as const;
export const QUEUE_ENQUEUE_INVALID_PAYLOAD = "invalid-payload" as const;
export const QUEUE_ENQUEUE_CAPACITY_EXCEEDED = "capacity-exceeded" as const;
export const QUEUE_TRANSITION_UPDATED = "updated" as const;
export const QUEUE_TRANSITION_MISSING = "missing" as const;
export const QUEUE_TRANSITION_LEASE_MISMATCH = "lease-mismatch" as const;

export const QUEUE_LEASE_OWNER_MAX_LENGTH = 128;

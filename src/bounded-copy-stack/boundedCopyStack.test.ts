import { describe, expect, it } from "vitest";

import { getBoundedCopyStackCandidates, pushBoundedCopyStackItem, type BoundedCopyStackItem } from "./boundedCopyStack";

type TestPayload = {
	value: string;
};

type TestMeta = {
	label: string;
};

function item(id: string, fingerprint = id, copiedAt = 1): BoundedCopyStackItem<TestPayload, TestMeta> {
	return {
		id,
		fingerprint,
		payload: { value: id },
		meta: { label: id },
		copiedAt
	};
}

describe("bounded copy stack", () => {
	it("добавляет новый элемент в начало стека", () => {
		const result = pushBoundedCopyStackItem([item("a")], {
			id: "b",
			fingerprint: "b",
			payload: { value: "b" },
			meta: { label: "b" },
			copiedAt: 2
		});

		expect(result.updatedExisting).toBe(false);
		expect(result.items.map((entry) => entry.id)).toEqual(["b", "a"]);
	});

	it("ограничивает размер и удаляет самый старый элемент", () => {
		const result = pushBoundedCopyStackItem([item("c"), item("b"), item("a")], {
			id: "d",
			fingerprint: "d",
			payload: { value: "d" },
			meta: { label: "d" },
			copiedAt: 4
		});

		expect(result.items.map((entry) => entry.id)).toEqual(["d", "c", "b"]);
	});

	it("поднимает существующий fingerprint наверх без дубля", () => {
		const result = pushBoundedCopyStackItem([item("c"), item("b"), item("a")], {
			id: "a2",
			fingerprint: "a",
			payload: { value: "a2" },
			meta: { label: "Обновлено" },
			copiedAt: 5
		});

		expect(result.updatedExisting).toBe(true);
		expect(result.items).toHaveLength(3);
		expect(result.items.map((entry) => entry.fingerprint)).toEqual(["a", "c", "b"]);
		expect(result.items[0].payload).toEqual({ value: "a2" });
	});

	it("использует переданный размер стека", () => {
		const result = pushBoundedCopyStackItem(
			[item("b"), item("a")],
			{
				id: "c",
				fingerprint: "c",
				payload: { value: "c" },
				meta: { label: "c" },
				copiedAt: 3
			},
			{ maxSize: 2 }
		);

		expect(result.items.map((entry) => entry.id)).toEqual(["c", "b"]);
	});

	it("фильтрует подходящих кандидатов", () => {
		const candidates = getBoundedCopyStackCandidates([item("format"), item("filter"), item("formula")], (entry) =>
			entry.id.startsWith("f")
		);

		expect(candidates.map((entry) => entry.id)).toEqual(["format", "filter", "formula"]);
	});
});

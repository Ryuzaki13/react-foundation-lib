import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { onErrorOptimistic, onMutateOptimistic, onSettledOptimistic, onSuccessOptimistic } from "./queryClient";

type Item = {
	id: string;
	done: boolean;
	label?: string;
};

function createTestQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false }
		}
	});
}

describe("query-client optimistic helpers", () => {
	it("сохраняет snapshot, применяет optimistic patch и откатывает ошибку", async () => {
		const queryClient = createTestQueryClient();
		const queryKey = ["items"] as const;
		const initial: Item[] = [{ id: "1", done: false }];
		queryClient.setQueryData(queryKey, initial);

		const context = await onMutateOptimistic<Item[]>(queryClient, queryKey, (old) =>
			old?.map((item) => (item.id === "1" ? { ...item, done: true } : item))
		);

		expect(context.previous).toEqual(initial);
		expect(queryClient.getQueryData(queryKey)).toEqual([{ id: "1", done: true }]);

		onErrorOptimistic(queryClient, queryKey, context);

		expect(queryClient.getQueryData(queryKey)).toEqual(initial);
	});

	it("ничего не откатывает без предыдущего snapshot", () => {
		const queryClient = createTestQueryClient();
		const queryKey = ["items"] as const;

		onErrorOptimistic<Item[]>(queryClient, queryKey, { previous: undefined });

		expect(queryClient.getQueryData(queryKey)).toBeUndefined();
	});

	it("сливает серверный ответ с текущим optimistic cache", () => {
		const queryClient = createTestQueryClient();
		const queryKey = ["items"] as const;
		queryClient.setQueryData<Item[]>(queryKey, [{ id: "1", done: true }]);

		onSuccessOptimistic<Item[], Item>(queryClient, queryKey, { id: "1", done: true, label: "С сервера" }, (cache, serverItem) =>
			cache?.map((item) => (item.id === serverItem.id ? serverItem : item))
		);

		expect(queryClient.getQueryData(queryKey)).toEqual([{ id: "1", done: true, label: "С сервера" }]);
	});

	it("инвалидирует одиночный query key без немедленного refetch по умолчанию", async () => {
		const queryClient = createTestQueryClient();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

		await onSettledOptimistic(queryClient, ["items"]);

		expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["items"], refetchType: "none" });
	});

	it("инвалидирует несколько query key с указанным refetchType", async () => {
		const queryClient = createTestQueryClient();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

		await onSettledOptimistic(queryClient, [["items"], ["summary"]], { refetchType: "active" });

		expect(invalidateSpy).toHaveBeenNthCalledWith(1, { queryKey: ["items"], refetchType: "active" });
		expect(invalidateSpy).toHaveBeenNthCalledWith(2, { queryKey: ["summary"], refetchType: "active" });
	});
});

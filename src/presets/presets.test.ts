import { describe, expect, it } from "vitest";

import { getPresetOption, normalizePresetIds, resolvePresetOptionsByIds, type PresetOption } from "./presets";

type DemoPresetId = "first" | "second" | "third";

const demoOptions: readonly PresetOption<string>[] = [
	{ id: "first", label: "Первый" },
	{ id: "second", label: "Второй" },
	{ id: "third", label: "Третий" }
];

function isDemoPresetId(value: unknown): value is DemoPresetId {
	return value === "first" || value === "second" || value === "third";
}

describe("presets", () => {
	it("нормализует список id через переданный type guard", () => {
		expect(normalizePresetIds(["second", "unknown", "second", "first"], isDemoPresetId)).toEqual(["second", "first"]);
		expect(normalizePresetIds(undefined, isDemoPresetId, ["third"])).toEqual(["third"]);
		expect(normalizePresetIds([], isDemoPresetId, ["third"])).toEqual([]);
	});

	it("формирует список опций по id и сохраняет порядок", () => {
		expect(resolvePresetOptionsByIds(["third", "first", "third", "unknown"], demoOptions).map((option) => option.id)).toEqual([
			"third",
			"first"
		]);
	});

	it("ищет option по id", () => {
		expect(getPresetOption("second", demoOptions)).toEqual({ id: "second", label: "Второй" });
		expect(getPresetOption("unknown", demoOptions)).toBeNull();
		expect(getPresetOption(undefined, demoOptions)).toBeNull();
	});
});

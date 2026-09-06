import { createElement } from "react";

import { KeyboardSensor, MouseSensor, PointerSensor, TouchSensor, type KeyboardCoordinateGetter } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { useDndSortableSensors } from "./useDndSortableSensors";

type Sensors = ReturnType<typeof useDndSortableSensors>;

function captureSensors(options?: Parameters<typeof useDndSortableSensors>[0]) {
	let sensors: Sensors = [];
	function Harness() {
		sensors = useDndSortableSensors(options);
		return null;
	}
	renderToStaticMarkup(createElement(Harness));
	return sensors;
}

describe("useDndSortableSensors", () => {
	it("сохраняет единый PointerSensor и sortable-клавиатуру по умолчанию", () => {
		const sensors = captureSensors();

		expect(sensors.map(({ sensor }) => sensor)).toEqual([PointerSensor, KeyboardSensor]);
		expect(sensors[0]?.options).toMatchObject({ activationConstraint: { distance: 6 } });
		expect(sensors[1]?.options).toMatchObject({ coordinateGetter: sortableKeyboardCoordinates });
	});

	it("разделяет mouse и touch при настройке long press", () => {
		const sensors = captureSensors({ activationDistance: 10, touchActivation: { delay: 250, tolerance: 10 } });

		expect(sensors.map(({ sensor }) => sensor)).toEqual([MouseSensor, TouchSensor, KeyboardSensor]);
		expect(sensors[0]?.options).toMatchObject({ activationConstraint: { distance: 10 } });
		expect(sensors[1]?.options).toMatchObject({ activationConstraint: { delay: 250, tolerance: 10 } });
	});

	it("передаёт предметные координаты и клавиши KeyboardSensor", () => {
		const coordinateGetter: KeyboardCoordinateGetter = () => ({ x: 10, y: 20 });
		const keyboardCodes = { start: ["Space"], cancel: ["Escape"], end: ["Space"] };
		const sensors = captureSensors({ keyboardCoordinateGetter: coordinateGetter, keyboardCodes });

		expect(sensors[1]?.options).toMatchObject({ coordinateGetter, keyboardCodes });
	});
});

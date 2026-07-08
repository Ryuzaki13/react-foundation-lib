import { KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

export interface UseDndSortableSensorsOptions {
	activationDistance?: number;
}

/**
 * Стандартная конфигурация DnD-сенсоров для сортируемых списков.
 *
 * Зачем: исключить дублирование одинаковой настройки PointerSensor + KeyboardSensor
 * в каждом хуке персонализации (колонки, сортировки, группировки).
 *
 * @param distance — минимальное смещение указателя (px) для начала перетаскивания (по умолчанию 6).
 */
export function useDndSortableSensors(distanceOrOptions: number | UseDndSortableSensorsOptions = 6) {
	const distance = typeof distanceOrOptions === "number" ? distanceOrOptions : (distanceOrOptions.activationDistance ?? 6);

	return useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	);
}

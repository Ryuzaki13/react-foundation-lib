import {
	KeyboardSensor,
	MouseSensor,
	PointerSensor,
	TouchSensor,
	useSensor,
	useSensors,
	type KeyboardCodes,
	type KeyboardCoordinateGetter
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

export interface UseDndSortableSensorsOptions {
	activationDistance?: number;
	/**
	 * Отдельная touch-конфигурация сохраняет нативную прокрутку до long press.
	 * Без неё hook продолжает использовать единый PointerSensor.
	 */
	touchActivation?: {
		readonly delay: number;
		readonly tolerance?: number;
	};
	/** Позволяет предметной матрице выбирать только допустимые координаты вместо порядка sortable-list. */
	keyboardCoordinateGetter?: KeyboardCoordinateGetter;
	/** Переопределяет клавиши начала/завершения, когда Enter занят primary action компонента. */
	keyboardCodes?: KeyboardCodes;
}

/**
 * Стандартная конфигурация DnD-сенсоров для сортируемых списков и матриц.
 *
 * Зачем: исключить дублирование одинаковой настройки PointerSensor + KeyboardSensor
 * в каждом хуке персонализации (колонки, сортировки, группировки).
 *
 * @param distanceOrOptions — минимальное смещение указателя или расширенные настройки mouse/touch/keyboard.
 */
export function useDndSortableSensors(distanceOrOptions: number | UseDndSortableSensorsOptions = 6) {
	const options = typeof distanceOrOptions === "number" ? { activationDistance: distanceOrOptions } : distanceOrOptions;
	const distance = options.activationDistance ?? 6;
	const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance } });
	const mouseSensor = useSensor(MouseSensor, { activationConstraint: { distance } });
	const touchSensor = useSensor(TouchSensor, {
		activationConstraint: {
			delay: options.touchActivation?.delay ?? 0,
			tolerance: options.touchActivation?.tolerance ?? distance
		}
	});
	const keyboardSensor = useSensor(KeyboardSensor, {
		coordinateGetter: options.keyboardCoordinateGetter ?? sortableKeyboardCoordinates,
		keyboardCodes: options.keyboardCodes
	});

	return useSensors(
		options.touchActivation ? mouseSensor : pointerSensor,
		options.touchActivation ? touchSensor : undefined,
		keyboardSensor
	);
}

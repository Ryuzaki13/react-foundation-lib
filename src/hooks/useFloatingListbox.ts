import { type KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from "react";

import {
	autoPlacement,
	autoUpdate,
	flip,
	offset,
	type Placement,
	shift,
	size as floatingSize,
	useDismiss,
	useFloating,
	type UseFloatingReturn,
	useInteractions,
	type UseInteractionsReturn,
	useRole
} from "@floating-ui/react";

import { findFirstEnabledIndex, findLastEnabledIndex, findNextEnabledIndex, handleKeyboardActivation } from "../utils";
import {
	KEYBOARD_KEY_ARROW_DOWN,
	KEYBOARD_KEY_ARROW_UP,
	KEYBOARD_KEY_HOME,
	KEYBOARD_KEY_END,
	KEYBOARD_KEY_ESCAPE,
	KEYBOARD_KEY_TAB
} from "../utils/keyboardConstants";

// Общие стратегии размещения и параметры middleware не зависят от текущих options.
const FLOATING_LISTBOX_PLACEMENT_FLIP = "flip";
const FLOATING_LISTBOX_PLACEMENT_AUTO = "auto";
const FLOATING_LISTBOX_DEFAULT_PLACEMENT = "bottom-start";
const FLOATING_LISTBOX_VIEWPORT_PADDING = 8;
const FLOATING_LISTBOX_REFERENCE_OFFSET = 4;
const FLOATING_LISTBOX_MIN_HEIGHT = 120;

/** Геометрия, которую Floating UI вычислил для доступной стороны listbox. */
export type FloatingListboxSizeContext = {
	availableWidth: number;
	availableHeight: number;
	viewportWidth: number;
	viewportHeight: number;
	referenceWidth: number;
	referenceHeight: number;
};

/**
 * Размеры floating-элемента и CSS custom properties, которые специализированный
 * picker может вычислить из доступного viewport без собственного middleware.
 */
export type FloatingListboxSizeStyle = {
	width?: string;
	minWidth?: string;
	maxWidth?: string;
	maxHeight?: string;
} & {
	[customProperty: `--${string}`]: string | undefined;
};

export type FloatingListboxSizeResolver = (context: FloatingListboxSizeContext) => FloatingListboxSizeStyle;

/** Стратегия выбора стороны для floating-элемента относительно reference. */
export type FloatingListboxPlacementStrategy = typeof FLOATING_LISTBOX_PLACEMENT_FLIP | typeof FLOATING_LISTBOX_PLACEMENT_AUTO;

type FloatingListboxStandardSizeProperty = "width" | "minWidth" | "maxWidth" | "maxHeight";

type FloatingListboxAppliedSizeState = {
	customProperties: Set<`--${string}`>;
	standardProperties: Map<FloatingListboxStandardSizeProperty, string>;
};

/** Хранит свойства и их исходные значения до императивного применения resolver. */
const floatingListboxAppliedSizeState = new WeakMap<HTMLElement, FloatingListboxAppliedSizeState>();

/** Хранит актуальный resolver отдельно от callback, который Floating UI может переиспользовать. */
const floatingListboxSizeResolvers = new WeakMap<object, FloatingListboxSizeResolver>();

/** Полный набор выровненных сторон для поиска наиболее просторного положения. */
const FLOATING_LISTBOX_AUTO_PLACEMENTS: Placement[] = [
	FLOATING_LISTBOX_DEFAULT_PLACEMENT,
	"bottom-end",
	"top-start",
	"top-end",
	"left-start",
	"left-end",
	"right-start",
	"right-end"
];

interface UseFloatingListboxParams<T> {
	options: readonly T[];
	selectedIndex: number;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	getOptionDisabled?: (option: T) => boolean;
	onSelect?: (option: T) => void;
	disabled?: boolean;
	placement?: Placement;
	/** `auto` сравнивает свободное место сверху, снизу, слева и справа. */
	placementStrategy?: FloatingListboxPlacementStrategy;
	closeOnSelect?: boolean;
	focusFloatingOnOpen?: boolean;
	allowOpenWithoutOptions?: boolean;
	restoreFocusOnClose?: boolean;
	resolveFloatingSize?: FloatingListboxSizeResolver;
}

/**
 * Форма результата использует публичные типы Floating UI: декларации пакета не
 * должны раскрывать пути его транзитивных зависимостей в конкретной установке.
 */
type UseFloatingListboxResult<T> = Pick<UseFloatingReturn, "refs" | "context" | "floatingStyles"> &
	Pick<UseInteractionsReturn, "getFloatingProps"> & {
		open: boolean;
		setOpen: (open: boolean) => void;
		activeIndex: number;
		setReference: UseFloatingReturn["refs"]["setReference"];
		setFloating: UseFloatingReturn["refs"]["setFloating"];
		setOptionRef: (index: number, node: HTMLElement | null) => void;
		close: () => void;
		openList: () => void;
		openWithIndex: (nextIndex: number) => void;
		toggleOpen: () => void;
		selectOption: (option: T) => void;
		selectActiveOption: () => void;
		handleReferenceKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
		handleFloatingKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
		getOptionId: (listId: string, index: number) => string;
		getActiveOptionId: (listId: string) => string | undefined;
	};

export function useFloatingListbox<T>({
	options,
	selectedIndex,
	open,
	onOpenChange,
	getOptionDisabled,
	onSelect,
	disabled,
	placement = FLOATING_LISTBOX_DEFAULT_PLACEMENT,
	placementStrategy = FLOATING_LISTBOX_PLACEMENT_FLIP,
	closeOnSelect = true,
	focusFloatingOnOpen = true,
	allowOpenWithoutOptions = false,
	restoreFocusOnClose = true,
	resolveFloatingSize
}: UseFloatingListboxParams<T>): UseFloatingListboxResult<T> {
	const optionRefs = useRef<Array<HTMLElement | null>>([]);
	const [internalOpen, setInternalOpen] = useState(false);
	const resolvedOpen = open ?? internalOpen;
	const setResolvedOpen = onOpenChange ?? setInternalOpen;
	const [currentActiveIndex, setActiveIndex] = useState(
		selectedIndex >= 0 ? selectedIndex : findFirstEnabledIndex(options, getOptionDisabled)
	);
	const [floatingSizeResolverOwner] = useState<object>(() => ({}));

	/**
	 * Поддерживает активный индекс в валидном состоянии при изменении набора опций
	 * или выбранного элемента, чтобы `aria-activedescendant` всегда ссылался на
	 * существующую и доступную опцию.
	 */
	const resolveActiveIndex = (activeIndex: number) => {
		if (options.length === 0) {
			return -1;
		}

		if (activeIndex >= 0 && activeIndex < options.length && !getOptionDisabled?.(options[activeIndex])) {
			return activeIndex;
		}

		if (selectedIndex >= 0 && selectedIndex < options.length && !getOptionDisabled?.(options[selectedIndex])) {
			return selectedIndex;
		}

		return findFirstEnabledIndex(options, getOptionDisabled);
	};
	const activeIndex = resolveActiveIndex(currentActiveIndex);
	const placementMiddleware =
		placementStrategy === FLOATING_LISTBOX_PLACEMENT_AUTO
			? autoPlacement({
					allowedPlacements: FLOATING_LISTBOX_AUTO_PLACEMENTS,
					/*
					 * Свободную сторону сравниваем по main axis. Варианты start/end при
					 * этом всё равно исключаются autoPlacement, если не помещаются по
					 * cross axis.
					 */
					crossAxis: false,
					padding: FLOATING_LISTBOX_VIEWPORT_PADDING
				})
			: flip({ padding: FLOATING_LISTBOX_VIEWPORT_PADDING });

	const { refs, floatingStyles, context, update } = useFloating({
		open: resolvedOpen,
		onOpenChange: setResolvedOpen,
		placement,
		transform: false,
		strategy: "fixed",
		middleware: [
			offset(FLOATING_LISTBOX_REFERENCE_OFFSET),
			placementMiddleware,
			shift({ padding: FLOATING_LISTBOX_VIEWPORT_PADDING }),
			floatingSize({
				padding: FLOATING_LISTBOX_VIEWPORT_PADDING,
				apply({ availableWidth, availableHeight, rects, elements }) {
					const viewport = elements.floating.ownerDocument.documentElement;
					const floatingStyle = elements.floating.style;
					const resolvedSize = floatingListboxSizeResolvers.get(floatingSizeResolverOwner)?.({
						availableWidth,
						availableHeight,
						viewportWidth: viewport.clientWidth,
						viewportHeight: viewport.clientHeight,
						referenceWidth: rects.reference.width,
						referenceHeight: rects.reference.height
					});

					/*
					 * Сначала сбрасываем размеры предыдущего resolver: Floating UI сохраняет
					 * один DOM-узел между режимами, поэтому старые width и CSS-переменные
					 * иначе продолжат влиять на следующий вариант отображения.
					 */
					const previousAppliedState = floatingListboxAppliedSizeState.get(elements.floating);
					for (const property of previousAppliedState?.customProperties ?? []) {
						floatingStyle.removeProperty(property);
					}
					for (const [property, previousValue] of previousAppliedState?.standardProperties ?? []) {
						floatingStyle[property] = previousValue;
					}

					floatingStyle.minWidth = `${rects.reference.width}px`;
					floatingStyle.maxHeight = `${Math.max(availableHeight, FLOATING_LISTBOX_MIN_HEIGHT)}px`;

					const nextCustomProperties = new Set<`--${string}`>();
					const nextStandardProperties = new Map<FloatingListboxStandardSizeProperty, string>();
					for (const [property, value] of Object.entries(resolvedSize ?? {})) {
						if (property.startsWith("--")) {
							const customProperty = property as `--${string}`;
							if (value !== undefined) {
								floatingStyle.setProperty(customProperty, value);
								nextCustomProperties.add(customProperty);
							}
							continue;
						}

						if (value !== undefined) {
							const standardProperty = property as FloatingListboxStandardSizeProperty;
							nextStandardProperties.set(standardProperty, floatingStyle[standardProperty]);
							floatingStyle[standardProperty] = value;
						}
					}
					floatingListboxAppliedSizeState.set(elements.floating, {
						customProperties: nextCustomProperties,
						standardProperties: nextStandardProperties
					});
				}
			})
		],
		whileElementsMounted: autoUpdate
	});
	const hasFloatingSizeResolver = resolveFloatingSize !== undefined;

	/*
	 * Floating UI сравнивает middleware структурно и может сохранить первый
	 * size.apply. WeakMap позволяет этому callback читать актуальный resolver после
	 * загрузки OData-узлов, не пересоздавая конкурирующие middleware.
	 */
	useLayoutEffect(() => {
		if (resolveFloatingSize) {
			floatingListboxSizeResolvers.set(floatingSizeResolverOwner, resolveFloatingSize);
		} else {
			floatingListboxSizeResolvers.delete(floatingSizeResolverOwner);
		}

		return () => {
			floatingListboxSizeResolvers.delete(floatingSizeResolverOwner);
		};
	}, [floatingSizeResolverOwner, resolveFloatingSize]);

	/**
	 * Асинхронно загруженные или отфильтрованные опции могут не изменить внешний
	 * rect popup: grid с прежним числом строк остаётся того же размера. Явный
	 * update повторно запускает placement и size middleware после commit списка.
	 */
	useLayoutEffect(() => {
		if (!resolvedOpen || !hasFloatingSizeResolver) {
			return;
		}

		void update();
	}, [hasFloatingSizeResolver, options.length, resolvedOpen, update]);

	const dismiss = useDismiss(context);
	const role = useRole(context, { role: "listbox" });
	const { getFloatingProps } = useInteractions([dismiss, role]);

	const canOpen = allowOpenWithoutOptions || options.length > 0;

	useEffect(() => {
		if (!resolvedOpen || activeIndex < 0) {
			return;
		}

		optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
	}, [activeIndex, resolvedOpen]);

	useEffect(() => {
		if (!resolvedOpen || !focusFloatingOnOpen) {
			return;
		}

		requestAnimationFrame(() => {
			refs.floating.current?.focus();
		});
	}, [focusFloatingOnOpen, resolvedOpen, refs]);

	const close = () => {
		setResolvedOpen(false);

		if (restoreFocusOnClose) {
			const referenceElement = refs.domReference.current;
			if (referenceElement instanceof HTMLElement) {
				referenceElement.focus();
			}
		}
	};

	const openWithIndex = (nextIndex: number) => {
		if (disabled || !canOpen) {
			return;
		}

		if (options.length > 0) {
			setActiveIndex(resolveActiveIndex(nextIndex));
		}

		setResolvedOpen(true);
	};

	const openList = () => {
		openWithIndex(selectedIndex >= 0 ? selectedIndex : findFirstEnabledIndex(options, getOptionDisabled));
	};

	const toggleOpen = () => {
		if (resolvedOpen) {
			close();
			return;
		}

		openList();
	};

	const selectOption = (option: T) => {
		if (getOptionDisabled?.(option)) {
			return;
		}

		onSelect?.(option);

		if (closeOnSelect) {
			close();
		}
	};

	const selectActiveOption = () => {
		if (activeIndex < 0) {
			return;
		}

		const activeOption = options[activeIndex];
		if (activeOption !== undefined) {
			selectOption(activeOption);
		}
	};

	const moveActiveToFirst = () => {
		setActiveIndex(findFirstEnabledIndex(options, getOptionDisabled));
	};

	const moveActiveToLast = () => {
		setActiveIndex(findLastEnabledIndex(options, getOptionDisabled));
	};

	const handleReferenceKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
		if (disabled) {
			return;
		}

		if (event.key === KEYBOARD_KEY_ARROW_DOWN) {
			event.preventDefault();

			if (!resolvedOpen) {
				openWithIndex(selectedIndex >= 0 ? selectedIndex : findFirstEnabledIndex(options, getOptionDisabled));
				return;
			}

			setActiveIndex((currentIndex) => findNextEnabledIndex(options, resolveActiveIndex(currentIndex), 1, getOptionDisabled));
			return;
		}

		if (event.key === KEYBOARD_KEY_ARROW_UP) {
			event.preventDefault();

			if (!resolvedOpen) {
				openWithIndex(selectedIndex >= 0 ? selectedIndex : findLastEnabledIndex(options, getOptionDisabled));
				return;
			}

			setActiveIndex((currentIndex) => findNextEnabledIndex(options, resolveActiveIndex(currentIndex), -1, getOptionDisabled));
			return;
		}

		if (event.key === KEYBOARD_KEY_HOME && resolvedOpen) {
			event.preventDefault();
			moveActiveToFirst();
			return;
		}

		if (event.key === KEYBOARD_KEY_END && resolvedOpen) {
			event.preventDefault();
			moveActiveToLast();
			return;
		}

		if (event.key === KEYBOARD_KEY_ESCAPE && resolvedOpen) {
			event.preventDefault();
			close();
			return;
		}

		if (event.key === KEYBOARD_KEY_TAB && resolvedOpen) {
			close();
		}
	};

	const handleFloatingKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
		if (event.target !== event.currentTarget) {
			if (event.key === KEYBOARD_KEY_ESCAPE) {
				event.preventDefault();
				close();
			}

			return;
		}

		if (event.key === KEYBOARD_KEY_ARROW_DOWN) {
			event.preventDefault();
			setActiveIndex((currentIndex) => findNextEnabledIndex(options, resolveActiveIndex(currentIndex), 1, getOptionDisabled));
			return;
		}

		if (event.key === KEYBOARD_KEY_ARROW_UP) {
			event.preventDefault();
			setActiveIndex((currentIndex) => findNextEnabledIndex(options, resolveActiveIndex(currentIndex), -1, getOptionDisabled));
			return;
		}

		if (event.key === KEYBOARD_KEY_HOME) {
			event.preventDefault();
			moveActiveToFirst();
			return;
		}

		if (event.key === KEYBOARD_KEY_END) {
			event.preventDefault();
			moveActiveToLast();
			return;
		}

		if (handleKeyboardActivation(event, selectActiveOption)) {
			return;
		}

		if (event.key === KEYBOARD_KEY_ESCAPE) {
			event.preventDefault();
			close();
			return;
		}

		if (event.key === KEYBOARD_KEY_TAB) {
			close();
		}
	};

	const getOptionId = (listId: string, index: number) => `${listId}-option-${index}`;
	const getActiveOptionId = (listId: string) => (activeIndex >= 0 ? getOptionId(listId, activeIndex) : undefined);

	return {
		open: resolvedOpen,
		setOpen: setResolvedOpen,
		activeIndex,
		refs,
		context,
		floatingStyles,
		getFloatingProps,
		setReference: refs.setReference,
		setFloating: refs.setFloating,
		setOptionRef: (index: number, node: HTMLElement | null) => {
			optionRefs.current[index] = node;
		},
		close,
		openList,
		openWithIndex,
		toggleOpen,
		selectOption,
		selectActiveOption,
		handleReferenceKeyDown,
		handleFloatingKeyDown,
		getOptionId,
		getActiveOptionId
	};
}

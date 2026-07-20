import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
	autoPlacement,
	autoUpdate,
	flip,
	offset,
	Placement,
	shift,
	size as floatingSize,
	useDismiss,
	useFloating,
	useInteractions,
	useRole
} from "@floating-ui/react";

import { findFirstEnabledIndex, findLastEnabledIndex, findNextEnabledIndex, handleKeyboardActivation } from "../utils";

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
export type FloatingListboxPlacementStrategy = "flip" | "auto";

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
	"bottom-start",
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

export function useFloatingListbox<T>({
	options,
	selectedIndex,
	open,
	onOpenChange,
	getOptionDisabled,
	onSelect,
	disabled,
	placement = "bottom-start",
	placementStrategy = "flip",
	closeOnSelect = true,
	focusFloatingOnOpen = true,
	allowOpenWithoutOptions = false,
	restoreFocusOnClose = true,
	resolveFloatingSize
}: UseFloatingListboxParams<T>) {
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
		placementStrategy === "auto"
			? autoPlacement({
					allowedPlacements: FLOATING_LISTBOX_AUTO_PLACEMENTS,
					/*
					 * Свободную сторону сравниваем по main axis. Варианты start/end при
					 * этом всё равно исключаются autoPlacement, если не помещаются по
					 * cross axis.
					 */
					crossAxis: false,
					padding: 8
				})
			: flip({ padding: 8 });

	const { refs, floatingStyles, context, update } = useFloating({
		open: resolvedOpen,
		onOpenChange: setResolvedOpen,
		placement,
		transform: false,
		strategy: "fixed",
		middleware: [
			offset(4),
			placementMiddleware,
			shift({ padding: 8 }),
			floatingSize({
				padding: 8,
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
					floatingStyle.maxHeight = `${Math.max(availableHeight, 120)}px`;

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

		if (event.key === "ArrowDown") {
			event.preventDefault();

			if (!resolvedOpen) {
				openWithIndex(selectedIndex >= 0 ? selectedIndex : findFirstEnabledIndex(options, getOptionDisabled));
				return;
			}

			setActiveIndex((currentIndex) => findNextEnabledIndex(options, resolveActiveIndex(currentIndex), 1, getOptionDisabled));
			return;
		}

		if (event.key === "ArrowUp") {
			event.preventDefault();

			if (!resolvedOpen) {
				openWithIndex(selectedIndex >= 0 ? selectedIndex : findLastEnabledIndex(options, getOptionDisabled));
				return;
			}

			setActiveIndex((currentIndex) => findNextEnabledIndex(options, resolveActiveIndex(currentIndex), -1, getOptionDisabled));
			return;
		}

		if (event.key === "Home" && resolvedOpen) {
			event.preventDefault();
			moveActiveToFirst();
			return;
		}

		if (event.key === "End" && resolvedOpen) {
			event.preventDefault();
			moveActiveToLast();
			return;
		}

		if (event.key === "Escape" && resolvedOpen) {
			event.preventDefault();
			close();
			return;
		}

		if (event.key === "Tab" && resolvedOpen) {
			close();
		}
	};

	const handleFloatingKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
		if (event.target !== event.currentTarget) {
			if (event.key === "Escape") {
				event.preventDefault();
				close();
			}

			return;
		}

		if (event.key === "ArrowDown") {
			event.preventDefault();
			setActiveIndex((currentIndex) => findNextEnabledIndex(options, resolveActiveIndex(currentIndex), 1, getOptionDisabled));
			return;
		}

		if (event.key === "ArrowUp") {
			event.preventDefault();
			setActiveIndex((currentIndex) => findNextEnabledIndex(options, resolveActiveIndex(currentIndex), -1, getOptionDisabled));
			return;
		}

		if (event.key === "Home") {
			event.preventDefault();
			moveActiveToFirst();
			return;
		}

		if (event.key === "End") {
			event.preventDefault();
			moveActiveToLast();
			return;
		}

		if (handleKeyboardActivation(event, selectActiveOption)) {
			return;
		}

		if (event.key === "Escape") {
			event.preventDefault();
			close();
			return;
		}

		if (event.key === "Tab") {
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

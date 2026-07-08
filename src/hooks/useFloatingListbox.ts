import { useEffect, useRef, useState } from "react";

import {
	autoUpdate,
	flip,
	size as floatingSize,
	offset,
	Placement,
	shift,
	useDismiss,
	useFloating,
	useInteractions,
	useRole
} from "@floating-ui/react";

import { findFirstEnabledIndex, findLastEnabledIndex, findNextEnabledIndex, handleKeyboardActivation } from "../utils";

interface UseFloatingListboxParams<T> {
	options: readonly T[];
	selectedIndex: number;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	getOptionDisabled?: (option: T) => boolean;
	onSelect?: (option: T) => void;
	disabled?: boolean;
	placement?: Placement;
	closeOnSelect?: boolean;
	focusFloatingOnOpen?: boolean;
	allowOpenWithoutOptions?: boolean;
	restoreFocusOnClose?: boolean;
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
	closeOnSelect = true,
	focusFloatingOnOpen = true,
	allowOpenWithoutOptions = false,
	restoreFocusOnClose = true
}: UseFloatingListboxParams<T>) {
	const optionRefs = useRef<Array<HTMLElement | null>>([]);
	const [internalOpen, setInternalOpen] = useState(false);
	const resolvedOpen = open ?? internalOpen;
	const setResolvedOpen = onOpenChange ?? setInternalOpen;
	const [currentActiveIndex, setActiveIndex] = useState(
		selectedIndex >= 0 ? selectedIndex : findFirstEnabledIndex(options, getOptionDisabled)
	);

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

	const { refs, floatingStyles, context } = useFloating({
		open: resolvedOpen,
		onOpenChange: setResolvedOpen,
		placement,
		transform: false,
		strategy: "fixed",
		middleware: [
			offset(4),
			flip({ padding: 8 }),
			shift({ padding: 8 }),
			floatingSize({
				padding: 8,
				apply({ availableHeight, rects, elements }) {
					Object.assign(elements.floating.style, {
						minWidth: `${rects.reference.width}px`,
						maxHeight: `${Math.max(availableHeight, 120)}px`
					});
				}
			})
		],
		whileElementsMounted: autoUpdate
	});

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

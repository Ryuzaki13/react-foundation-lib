import { type ComponentType, useMemo } from "react";

import { createLazyComponent } from "../utils/createLazyComponent";

/**
 * Хук для создания ленивой компоненты, которая будет загружена только при первом рендере.
 *
 * @example
 *
 * ```tsx
 * const MyComponent = () => {
 *  const TextEditor = useLazyComponent(
 *    () => import("@components/content/article/editor/TextEditor"),
 *    "TextEditor"
 *  );
 *
 *  return (
 *    <Suspense fallback={<div>Загрузка...</div>}>
 *      <TextEditor />
 *    </Suspense>
 *  );
 * };
 * ```
 *
 * @param importFn - функция, которая возвращает промис, который резолвится в объект с компонентами
 * @param componentName - имя компонента, который нужно загрузить
 * @returns
 */
const useLazyComponent = <TProps extends object>(
	importFn: () => Promise<Record<string, ComponentType<TProps>> | null>,
	componentName: string,
	cacheKey?: string
) => {
	return useMemo(() => createLazyComponent(importFn, componentName, cacheKey), [cacheKey, importFn, componentName]);
};

export { useLazyComponent };

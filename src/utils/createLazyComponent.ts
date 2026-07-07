import { lazy, type ComponentType, type LazyExoticComponent } from "react";

type LazyComponentModule<TProps extends object> = Record<string, ComponentType<TProps>>;
type LazyComponentImport<TProps extends object> = () => Promise<LazyComponentModule<TProps> | null>;

const lazyComponentCache = new WeakMap<object, Map<string | undefined, unknown>>();
const lazyComponentCacheByKey = new Map<string, unknown>();

/**
 * Создает ленивую компоненту, которая будет загружена только при первом рендере.
 *
 * @example
 *
 * ```tsx
 * const TextEditor = createLazyComponent(
 *   () => import("@components/content/article/editor/TextEditor"),
 *   "TextEditor"
 * );
 * ```
 *
 * @param importPath - функция, которая возвращает промис, который резолвится в объект с компонентами
 * @param componentName - имя компонента, который нужно загрузить
 * @returns
 */
export const createLazyComponent = <TProps extends object>(
	importPath: LazyComponentImport<TProps>,
	componentName: string,
	cacheKey?: string
): LazyExoticComponent<ComponentType<TProps>> => {
	const lazyCacheKey = cacheKey ? `${cacheKey}:${componentName ?? "default"}` : undefined;
	if (lazyCacheKey && lazyComponentCacheByKey.has(lazyCacheKey)) {
		return lazyComponentCacheByKey.get(lazyCacheKey)! as LazyExoticComponent<ComponentType<TProps>>;
	}

	if (!lazyComponentCache.has(importPath)) {
		lazyComponentCache.set(importPath, new Map());
	}

	const componentMap = lazyComponentCache.get(importPath)!;

	if (!componentMap.has(componentName)) {
		const lazyComponent = lazy(() =>
			importPath().then((module) => {
				if (!module) {
					throw new Error(`Component not found or invalid in module: ${componentName ?? "default"}`);
				}

				const component =
					componentName && module[componentName] ? module[componentName] : (module.default ?? Object.values(module)[0]);

				if (!component || typeof component !== "function") {
					throw new Error(`Could not lazy-load component "${componentName ?? "default"}"`);
				}

				return { default: component };
			})
		);

		componentMap.set(componentName, lazyComponent);
		if (lazyCacheKey) {
			lazyComponentCacheByKey.set(lazyCacheKey, lazyComponent);
		}
	}

	return componentMap.get(componentName)! as LazyExoticComponent<ComponentType<TProps>>;
};

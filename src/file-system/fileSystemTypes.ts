/** Определяет, какую существующую часть пути дополнительно проверить через Node.js realpath. */
export type PathRealpathMode = "none" | "parent" | "target";

/** Root принадлежит серверной конфигурации; сегменты обозначают только путь внутри него. */
export type ResolvePathInsideRootOptions = Readonly<{
	rootPath: string;
	pathSegments: readonly string[];
	/** По умолчанию проверяется существующий target, включая символические ссылки. */
	realpathMode?: PathRealpathMode;
}>;

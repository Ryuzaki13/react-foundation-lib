import { type PATH_REALPATH_NONE, type PATH_REALPATH_PARENT, type PATH_REALPATH_TARGET } from "./fileSystemConstants";

/** Определяет, какую существующую часть пути дополнительно проверить через Node.js realpath. */
export type PathRealpathMode = typeof PATH_REALPATH_NONE | typeof PATH_REALPATH_PARENT | typeof PATH_REALPATH_TARGET;

/** Root принадлежит серверной конфигурации; сегменты обозначают только путь внутри него. */
export type ResolvePathInsideRootOptions = Readonly<{
	rootPath: string;
	pathSegments: readonly string[];
	/** По умолчанию проверяется существующий target, включая символические ссылки. */
	realpathMode?: PathRealpathMode;
}>;

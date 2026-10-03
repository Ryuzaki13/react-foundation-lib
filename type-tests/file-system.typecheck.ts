import {
	isFileSystemNotFoundError,
	resolvePathInsideRoot,
	type PathRealpathMode,
	type ResolvePathInsideRootOptions
} from "../src/file-system";

const pathSegments: readonly string[] = ["documents", "file.pdf"];
const mode: PathRealpathMode = "parent";
const options = { rootPath: "/srv/files", pathSegments, realpathMode: mode } satisfies ResolvePathInsideRootOptions;
const resolvePath: (options: ResolvePathInsideRootOptions) => Promise<string> = resolvePathInsideRoot;
const isMissing: (error: unknown) => boolean = isFileSystemNotFoundError;
void [resolvePath, isMissing, options];

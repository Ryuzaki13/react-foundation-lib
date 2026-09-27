import { type RefObject } from "react";

import {
	useDocumentScrollLock,
	useVisualViewportFrame,
	type UseDocumentScrollLockOptions,
	type UseVisualViewportFrameOptions
} from "../src/dom";

const lock: (options: UseDocumentScrollLockOptions) => void = useDocumentScrollLock;
const frame: (options: UseVisualViewportFrameOptions) => void = useVisualViewportFrame;
const divRef: RefObject<HTMLDivElement | null> = { current: null };
const frameOptions = { active: true, containerRef: divRef } satisfies UseVisualViewportFrameOptions;
const lockOptions = { active: true, documentTarget: null, compensateScrollbar: true } satisfies UseDocumentScrollLockOptions;
void [lock, frame, frameOptions, lockOptions];

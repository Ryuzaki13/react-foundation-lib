import { ReferenceType } from "@floating-ui/react";

export const isDomReference = (ref: ReferenceType | null): ref is Element => ref instanceof Element;

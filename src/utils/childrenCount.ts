import { Children, Fragment, isValidElement, PropsWithChildren, ReactElement, ReactNode } from "react";

function isFragmentElement(node: ReactNode): node is ReactElement<PropsWithChildren> {
	return isValidElement<PropsWithChildren>(node) && node.type === Fragment;
}

export function childrenCount(node: ReactNode): number {
	return Children.toArray(node).reduce<number>((count, child) => {
		if (isFragmentElement(child)) {
			return count + childrenCount(child.props.children);
		}
		return count + 1;
	}, 0);
}

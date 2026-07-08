type TreeNode<T> = T & {
	children?: TreeNode<T>[];
};

export function deepCopyNodes<T extends { children?: TreeNode<T>[] }>(nodes: TreeNode<T>[]): TreeNode<T>[] {
	return nodes.map((node) => {
		const copy = { ...node } as TreeNode<T>;

		if (node.children) {
			copy.children = deepCopyNodes(node.children);
		}

		return copy;
	});
}

export function deepCopyTree<T>(nodes: T[], childrenField: keyof T = "children" as keyof T): T[] {
	return nodes.map((node) => {
		const copy = { ...node };

		const children = node[childrenField] as unknown as T[];
		if (children && Array.isArray(children)) {
			(copy[childrenField] as unknown) = deepCopyTree(children, childrenField);
		}

		return copy;
	});
}

import { parseNumber } from "../number";

import type { RowBasedFormatterContext, RowBasedFormatterContextInstrumentation } from "./types";

export function createRowBasedFormatterContext(args: {
	rowData: Record<string, unknown>;
	rawValue: unknown;
	columnId: string;
	keys?: readonly string[];
	instrumentation?: RowBasedFormatterContextInstrumentation;
}): RowBasedFormatterContext {
	// TODO: duplicate createTableFormulaContext src\shared\lib\formulas\execute.ts
	const keys = [...(args.keys ?? [])];

	const readKey = (index: number): string | undefined => {
		if (!Number.isInteger(index) || index < 0) {
			args.instrumentation?.onOutOfRangeIndex?.(index);
			return undefined;
		}

		args.instrumentation?.onReadIndex?.(index);

		if (index >= keys.length) {
			args.instrumentation?.onOutOfRangeIndex?.(index);
			return undefined;
		}

		return keys[index];
	};

	const readValue = (index: number): unknown => {
		const key = readKey(index);
		if (!key) return undefined;
		return args.rowData[key];
	};

	const readNum = (index: number): number => {
		const key = readKey(index);
		if (!key) return 0;
		return parseNumber(args.rowData[key]);
	};

	return {
		rowData: args.rowData,
		rawValue: args.rawValue,
		columnId: args.columnId,
		key: readKey,
		value: readValue,
		num: readNum
	};
}

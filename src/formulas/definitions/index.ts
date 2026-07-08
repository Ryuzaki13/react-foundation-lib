import { addFormula, divideFormula, multiplyFormula, percentFormula, substractFormula } from "./base";
import { growthPercent, markupFormula, markupSSCFormula, planDeviationPercent, sscPerTon } from "./sales";

import type { TableFormulaDefinition } from "../types";

export const tableFormulaDefinitions: readonly TableFormulaDefinition[] = Object.freeze([
	divideFormula,
	multiplyFormula,
	substractFormula,
	addFormula,
	percentFormula,

	markupFormula,
	markupSSCFormula,
	planDeviationPercent,
	growthPercent,
	sscPerTon
]);

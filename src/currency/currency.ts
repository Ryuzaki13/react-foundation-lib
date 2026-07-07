import { type WrappedODataParameters } from "../odata-service";

const CURRENCY_PARAMETER_ID = "p_curr";

/** Runtime-режим валюты, который задается общим OData-параметром страницы. */
export type CurrencyMode = "internal" | "rub";

/** Собирает display-подпись с валютным суффиксом. */
export function resolveCurrencyAwareLabel(
	label: string,
	currencyLabels: readonly [string, string] | undefined,
	currencyMode: CurrencyMode | null | undefined
): string {
	if (!currencyLabels || !currencyMode) {
		return label;
	}

	const currencyLabelIndex = currencyMode === "internal" ? 0 : 1;
	const currencyLabel = currencyLabels[currencyLabelIndex]?.trim();
	const hasComma = currencyLabel.startsWith(",");

	// NOTE: нужно закрепить правило, что запятая ставится в currencyLabel
	return currencyLabel ? `${label}${hasComma ? "" : " "}${currencyLabel}` : label;
}

/** Определяет режим валюты по общему OData-параметру `p_curr`. */
export function resolveCurrencyModeFromODataParameters(params?: WrappedODataParameters): CurrencyMode | null {
	if (!params || !Object.prototype.hasOwnProperty.call(params, CURRENCY_PARAMETER_ID)) {
		return null;
	}

	const value = params[CURRENCY_PARAMETER_ID]?.value;
	if (value === false) return "internal";
	if (value === true) return "rub";

	return null;
}

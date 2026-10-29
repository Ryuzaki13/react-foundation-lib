import {
	DEFAULT_NUMBER_PRESET_NAMES,
	NUMBER_PRESET_NAME_RATIO_PERCENT,
	compileFormattersPipelineExecutor,
	formatNumber,
	formatNumberAsPercent,
	getNumberPreset,
	registerNumberPreset,
	type FormattersPipelineConfig,
	type NumberFormatPreset,
	type NumberFormatPresetConfig
} from "../src/formatters";

// Новый marker не становится обязательным для существующих полных объектов и конфигураций.
const existingPreset: NumberFormatPreset = {
	name: "existing-custom",
	decimals: 2,
	decimalSeparator: ",",
	grouping: false,
	groupingSeparator: " ",
	groupingSize: 3
};
const existingConfig: NumberFormatPresetConfig = { name: "existing-config", decimals: 1 };
const customRatioPreset: NumberFormatPreset = { ...existingPreset, name: "custom-ratio", style: "percent", decimals: 3 };
const customRatioConfig: NumberFormatPresetConfig = { name: "custom-ratio-config", style: "percent", decimals: 0 };
const explicitDecimalConfig: NumberFormatPresetConfig = { name: "explicit-decimal", style: "decimal" };
const presetName: "ratio-percent" = NUMBER_PRESET_NAME_RATIO_PERCENT;
const defaultPresetName: typeof NUMBER_PRESET_NAME_RATIO_PERCENT = DEFAULT_NUMBER_PRESET_NAMES.ratioPercent;

const existingText: string = formatNumber(0.2, existingPreset);
const existingPercentText: string = formatNumberAsPercent(0.2);
const ratioText: string = formatNumber(0.2, presetName);
const customRatioText: string = formatNumber(0.2, customRatioPreset);
const registeredPreset: NumberFormatPreset = registerNumberPreset(existingConfig);
const registeredRatioPreset: NumberFormatPreset = registerNumberPreset(customRatioConfig);
const registeredDecimalPreset: NumberFormatPreset = registerNumberPreset(explicitDecimalConfig);
const foundPreset: NumberFormatPreset | undefined = getNumberPreset(defaultPresetName);

// Имя нового preset проходит через прежний typed-value pipeline без изменения его shape.
const pipeline: FormattersPipelineConfig = {
	version: 1,
	plan: {
		steps: [{ id: "ratio", type: "typedValueFormat", config: { numberPresetName: defaultPresetName } }]
	}
};
const compiled = compileFormattersPipelineExecutor({ config: pipeline, column: { role: "measure", type: "int" } });

void [
	existingText,
	existingPercentText,
	ratioText,
	customRatioText,
	registeredPreset,
	registeredRatioPreset,
	registeredDecimalPreset,
	foundPreset,
	compiled
];

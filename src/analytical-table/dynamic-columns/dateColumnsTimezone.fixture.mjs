import { createJiti } from "jiti";

// Отдельный Node получает TZ до загрузки исходников и создания Intl-пресетов.
// Jiti позволяет проверять текущий модуль, не требуя предварительной сборки dist.
const jiti = createJiti(import.meta.url);
const { aggregateAnalyticalDateFacts, createAnalyticalDateColumnsPlan } = await jiti.import("./index.ts");
const plan = createAnalyticalDateColumnsPlan(JSON.parse(process.argv[2]));

process.stdout.write(
	JSON.stringify({
		timeZone: new Intl.DateTimeFormat().resolvedOptions().timeZone,
		columns: plan.columns,
		values: aggregateAnalyticalDateFacts([{ unit: 1, person: 2, date: "2026-01-30", value: 2 }], plan)
	})
);

/** Лимит относится к строке целиком, включая знак и точку; точность не округляется. */
export type DecimalOptions = Readonly<{ maxLength?: number }>;

export type DecimalComparison = -1 | 0 | 1;

/** Отношение сохраняется без деления: знаменатель должен быть строго положительным. */
export type DecimalRatio = Readonly<{ numerator: string; denominator: string }>;

/** Приватное вычислительное представление, не входящее в публичный entrypoint. */
export type DecimalParts = Readonly<{ coefficient: bigint; scale: number }>;

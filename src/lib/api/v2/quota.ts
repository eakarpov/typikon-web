// Арифметика суточной квоты. Отдельно от учёта расхода (usage.ts) потому, что учёт
// ходит в базу, а решение «пускать или нет» — чистое и должно проверяться тестами.
//
// Сутки считаются по UTC — это 03:00 по Москве. Момент выбран не из любви к UTC, а
// потому что так граница не зависит от перевода часов и одинакова для всех клиентов.

/** Сутки в виде ГГГГ-ММ-ДД по UTC. */
export const dayKey = (at: Date = new Date()): string => at.toISOString().slice(0, 10);

/** Сколько секунд осталось до обнуления суточного счётчика. */
export const secondsUntilReset = (at: Date = new Date()): number => {
    const next = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() + 1);
    return Math.max(1, Math.ceil((next - at.getTime()) / 1000));
};

export interface QuotaVerdict {
    allowed: boolean;
    /** Потолок за сутки; null — потолка нет. */
    limit: number | null;
    remaining: number | null;
    /** Секунд до обнуления. */
    resetIn: number;
}

/**
 * Решение по уже израсходованному. Исчерпавшему квоту запрос не засчитывается: иначе
 * он разгонял бы счётчик собственными отказами и квота не обновилась бы никогда.
 */
export const decide = (used: number, perDay: number | null, now: Date = new Date()): QuotaVerdict => {
    const resetIn = secondsUntilReset(now);

    if (perDay === null) return { allowed: true, limit: null, remaining: null, resetIn };
    if (used >= perDay) return { allowed: false, limit: perDay, remaining: 0, resetIn };

    return { allowed: true, limit: perDay, remaining: Math.max(0, perDay - used - 1), resetIn };
};

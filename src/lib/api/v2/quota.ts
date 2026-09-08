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

/**
 * Решение по двум потолкам разом: общему на ключ и подушевому.
 *
 * Отдельно от списания, потому что порядок здесь и есть суть. **Оба потолка
 * проверяются до того, как списан хоть один** — иначе отказ по одному разгонял
 * бы счётчик другого, а правило ровно обратное: исчерпавшему квоту запрос не
 * засчитывается, иначе он разгонял бы счётчик собственными отказами и квота не
 * обновилась бы никогда.
 *
 * Возвращается более тесный из двух остатков: клиент упрётся именно в него, и
 * обещать ему запас, которого у него нет, — врать.
 */
export const decidePair = (
    sharedUsed: number,
    perDay: number | null,
    ownUsed: number,
    perDevice: number | null,
    now: Date = new Date(),
): { verdict: QuotaVerdict; charge: boolean } => {
    const shared = decide(sharedUsed, perDay, now);
    if (!shared.allowed) return { verdict: shared, charge: false };

    const own = decide(ownUsed, perDevice, now);
    if (!own.allowed) return { verdict: own, charge: false };

    // Оба разрешили — списываем оба. `null` означает «потолка нет» и в сравнении
    // остатков не участвует.
    if (own.remaining === null) return { verdict: shared, charge: true };
    if (shared.remaining === null) return { verdict: own, charge: true };

    return {
        verdict: own.remaining <= shared.remaining ? own : shared,
        charge: true,
    };
};

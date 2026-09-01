// Мост к движку устава: спросить дни месяца и разметить их тем, чего движок
// сам не отдаёт, но что выводится из его ответа без единой новой записи.

import { ordoDay, type OrdoDay, type OrdoPrestol, type OrdoVariant } from "@/lib/ordo";

/**
 * ДВУНАДЕСЯТЫЙ ПРАЗДНИК движок отдельным признаком не отдаёт — и заводить его
 * там незачем, он выводится нацело.
 *
 * Неподвижные девять уже размечены праздничным кругом Минеи (feast_cycle):
 * Рождество, Богоявление, Сретение, Благовещение, Преображение, Успение,
 * Рождество Богородицы, Воздвижение, Введение — ровно они, и ни Покрова, ни
 * Обрезания там нет. Подвижные три считаются от Пасхи.
 *
 * Сама Пасха сюда НЕ входит: она не двунадесятый праздник, а праздников
 * праздник, и правило «в двунадесятые две литургии» к ней не относится —
 * пасхальная ночь устроена по-своему.
 */
const MOVABLE_DVUNADESYATYE = [-7, 39, 49];   // Вход Господень, Вознесение, Пятидесятница

export const isDvunadesyaty = (day: OrdoDay, variant: OrdoVariant): boolean =>
    variant.feast === "prazdnik" || MOVABLE_DVUNADESYATYE.includes(day.paschaOffset);

/** Престольный праздник: движок нашёл храмовую главу для наших престолов. */
export const isPrestolny = (variant: OrdoVariant): boolean => Boolean(variant.hram);

// КЭШ ЗДЕСЬ НЕ СТАВИТСЯ, И ЭТО ВАЖНО. Просилось обратное: ответ движка на
// прошедшую дату не меняется вовсе, и держать его сутками было бы разумно.
// Но месяц целиком уже кэшируется (schedule.ts), а unstable_cache внутри
// unstable_cache Next не обещает — и не отдаёт: при вложении часть дней
// возвращалась пустой, и в расписании молча пропадали строки. Восемь чисел
// из тридцати одного, каждый раз разные, — молчаливая пропажа, которую в
// готовом расписании не заметил бы никто.
//
// Движок отвечает за пятьдесят миллисекунд; месяц спрашивается целиком раз в
// час. Кэшировать надо СНАРУЖИ, у месяца, и только там.
export const ordoDayUncached = (
    date: string,
    opts?: { ustav?: string | null; prestoly?: OrdoPrestol[] },
) => ordoDay(date, { ustav: opts?.ustav ?? undefined, prestoly: opts?.prestoly });

/** Сколько дат спрашиваем разом. Столько же, сколько в /calendar.ics: движок
 *  отвечает за миллисекунды, но занимать им весь пул соединений незачем. */
const CONCURRENCY = 8;

export interface OrdoRangeResult {
    days: Map<string, OrdoDay>;
    /** Даты, на которые движок не ответил. */
    failed: string[];
}

export const ordoRange = async (
    dates: string[],
    opts?: { ustav?: string | null; prestoly?: OrdoPrestol[] },
): Promise<OrdoRangeResult> => {
    const days = new Map<string, OrdoDay>();
    const ask = async (d: string) => {
        try {
            return await ordoDayUncached(d, opts);
        } catch (e) {
            console.error(`parish: не удалось спросить устав про ${d}`, e);
            return null;
        }
    };

    for (let i = 0; i < dates.length; i += CONCURRENCY) {
        const chunk = dates.slice(i, i + CONCURRENCY);
        const got = await Promise.all(chunk.map(async d => [d, await ask(d)] as const));
        for (const [d, day] of got) if (day) days.set(d, day);
    }

    // ВТОРОЙ ЗАХОД — ПО ОДНОМУ. Первый сбой почти всегда не «движок не знает
    // этого дня», а «мы спросили восьмерых разом и не дождались»: клиент рвёт
    // соединение по таймауту, и в логе службы остаётся broken pipe. Повтор
    // поодиночке стоит миллисекунды и снимает почти все такие потери; то, что
    // не ответило и во второй раз, — уже настоящий сбой, и о нём говорится.
    const failed: string[] = [];
    for (const d of dates.filter(x => !days.has(x))) {
        const day = await ask(d);
        if (day) days.set(d, day); else failed.push(d);
    }
    return { days, failed };
};

const pad = (n: number) => String(n).padStart(2, "0");
export const isoDate = (d: Date) =>
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/**
 * Даты месяца — и ещё один день сверх него.
 *
 * Лишний день не про запас: вечернее стояние первого числа СЛЕДУЮЩЕГО месяца
 * ложится на вечер последнего числа этого. Не спросив его, расписание
 * оборвалось бы на пустом вечере — том самом, в который приход придёт.
 */
export const monthDates = (year: number, month: number): string[] => {
    const out: string[] = [];
    const d = new Date(Date.UTC(year, month - 1, 1));
    while (d.getUTCMonth() === month - 1) {
        out.push(isoDate(d));
        d.setUTCDate(d.getUTCDate() + 1);
    }
    out.push(isoDate(d));
    return out;
};

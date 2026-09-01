import { cached, CacheTag } from "@/lib/cache";
import { getTemple, type Temple } from "@/lib/temples";
import { monthDates, ordoRange } from "./engine";
import { buildMonth } from "./gatherings";
import { DEFAULT_RULES } from "./presets";
import { applyEdits, editsOf } from "./edits";
import { driftedDays, publishedMonth } from "./publish";
import type { ParishDay, ParishSettings } from "./types";

/**
 * Приход — это ХРАМ, который у нас уже есть.
 *
 * Заводить рядом свою запись прихода пока незачем: имя, место и престолы
 * лежат в `temples`, престолы там сматчены с памятями (`memoryIds`), а устав
 * помечен полем `ustav`. Не хватает одного — часов, и они пока берутся
 * умолчанием. Своя коллекция понадобится, когда часы начнут править руками.
 */
export const settingsOf = (temple: Temple): ParishSettings => ({
    slug: temple.slug,
    title: temple.name,
    // Часовой пояс нужен подписному календарю; у храма его пока нет, и Москва
    // здесь — умолчание, а не знание. Ставится оно видимым, чтобы не выдать
    // догадку за настройку.
    timezone: "Europe/Moscow",
    ustav: temple.ustav ?? null,
    prestoly: (temple.prestoly ?? [])
        .filter(p => p.state !== "lost" && p.memoryIds?.length)
        .map(p => ({
            memoryId: p.memoryIds[0],
            kind: p.kind ?? null,
            // приход поминает престол своими словами, и они важнее наших
            label: p.label ?? null,
        })),
    rules: DEFAULT_RULES,
});

export interface ParishMonth {
    slug: string;
    title: string;
    month: string;
    monthLabel: string;
    days: ParishDay[];
    /** Служба устава не поднята — расписание строить не из чего. */
    unavailable: boolean;
    /** Даты, на которые устав не ответил: их в расписании нет, и это сказано. */
    failed: string[];
}

const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль",
    "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];

const build = async (slug: string, month: string): Promise<ParishMonth | null> => {
    const temple = await getTemple(slug);
    if (!temple) return null;

    const [year, mon] = month.split("-").map(Number);
    if (!year || !mon || mon < 1 || mon > 12) return null;

    const settings = settingsOf(temple);
    const dates = monthDates(year, mon);
    const { days, failed } = await ordoRange(dates, {
        ustav: settings.ustav,
        prestoly: settings.prestoly.map(p => ({
            memoryId: p.memoryId, kind: p.kind, label: p.label,
        })),
    });

    const prefix = `${year}-${String(mon).padStart(2, "0")}`;
    return {
        slug, title: temple.name, month,
        monthLabel: `${MONTHS[mon - 1]} ${year}`,
        days: buildMonth(days, settings, d => d.startsWith(prefix)),
        unavailable: days.size === 0,
        failed: failed.filter(d => d.startsWith(prefix)),
    };
};

// ПРОЕКТ кэшируется: он выводится из устава и приходских правил, и меняется
// только вместе с ними.
export const parishMonth = cached(
    build,
    ["parish-month"],
    [CacheTag.PARISH],
    3600,
);

/**
 * Расписание, каким его видят: проект устава плюс правки ответственного.
 *
 * Правки читаются МИМО кэша — их правят по одной, и держать их час значило бы
 * показывать ответственному не то, что он только что исправил.
 */
export const parishSchedule = async (slug: string, month: string) => {
    const data = await parishMonth(slug, month);
    if (!data) return null;
    const edits = await editsOf(slug, month);
    const { days, applied } = applyEdits(data.days, edits);
    return { ...data, days, edits: applied };
};

export interface ParishView extends ParishMonth {
    edits: Awaited<ReturnType<typeof parishSchedule>> extends null ? never
        : NonNullable<Awaited<ReturnType<typeof parishSchedule>>>["edits"];
    /** Ответственный сказал «готово» — и вот когда. */
    published: Date | null;
    /** Числа, в которых снимок разошёлся с нынешним выводом устава. */
    drifted: string[];
}

/**
 * ЧТО ПОКАЗАТЬ ЧЕЛОВЕКУ.
 *
 * Опубликованное показывается СНИМКОМ, а не свежим выводом: ответственный повесил
 * на стенд определённый лист, и наша правка правил не вправе молча передвинуть
 * ему час — прихожанин придёт не тогда. Лист висит, пока его не заменят.
 *
 * Расхождение при этом считается и отдаётся: видеть его должен ответственный, а
 * решать — он же. Молча пересобрать за него нельзя, молча смолчать тоже.
 */
export const parishView = async (slug: string, month: string): Promise<ParishView | null> => {
    const live = await parishSchedule(slug, month);
    if (!live) return null;
    const snapshot = await publishedMonth(slug, month);
    if (!snapshot?.days?.length) {
        return { ...live, published: null, drifted: [] } as ParishView;
    }
    return {
        ...live,
        days: snapshot.days,
        published: snapshot.publishedAt ?? null,
        drifted: driftedDays(snapshot.days, live.days),
    } as ParishView;
};

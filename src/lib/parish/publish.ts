import clientPromise from "@/lib/mongodb";
import type { ParishDay } from "./types";

// «ЭТОТ МЕСЯЦ ГОТОВ».
//
// Пока настоятель не сказал этого, расписание остаётся ПРОЕКТОМ: оно выведено
// из устава, и мы за него отвечаем, а он — нет. Показывать проект прихожанину
// можно и нужно (лучше выведенное, чем ничего), но называть его расписанием
// храма нельзя, пока храм его не признал.
//
// ОПУБЛИКОВАННОЕ ХРАНИТСЯ СНИМКОМ, и это главное решение здесь.
//
// Само расписание нигде не лежит: оно выводится заново из устава, приходских
// правил и правок. Для черновика это верно — он обязан идти за уставом. Но
// опубликованное так вести себя не вправе: настоятель повесил на стенд
// определённый лист, и если наша правка правил молча передвинет ему час,
// прихожанин придёт не тогда. Лист на стене висит, пока его не заменят, —
// так же и здесь.
//
// Оттого при публикации кладётся снимок, и он же показывается людям. А
// разошёлся ли он с уставом — видит настоятель, и решает он.

export type ScheduleStatus = "draft" | "published";

export interface ParishSchedule {
    _id?: string;
    parishSlug: string;
    month: string;
    status: ScheduleStatus;
    publishedAt?: Date | null;
    publishedBy?: string | null;
    /** Снимок на миг публикации. У черновика его нет вовсе. */
    days?: ParishDay[];
}

const collection = async () =>
    (await clientPromise).db("typikon").collection<ParishSchedule>("parishSchedules");

const idOf = (parishSlug: string, month: string) => `${parishSlug}:${month}`;

export const publishedMonth = async (
    parishSlug: string, month: string,
): Promise<ParishSchedule | null> => {
    const doc = await (await collection()).findOne({ _id: idOf(parishSlug, month) } as never);
    return doc && doc.status === "published" ? doc : null;
};

export const publishMonth = async (
    parishSlug: string, month: string, days: ParishDay[], userId: string,
) => {
    const col = await collection();
    await col.replaceOne(
        { _id: idOf(parishSlug, month) } as never,
        { _id: idOf(parishSlug, month), parishSlug, month, status: "published",
          publishedAt: new Date(), publishedBy: userId, days } as never,
        { upsert: true },
    );
};

/**
 * Снять с публикации. Снимок УДАЛЯЕТСЯ вместе со статусом: держать его при
 * снятом расписании незачем, а держать — значит однажды показать снятое.
 */
export const unpublishMonth = async (parishSlug: string, month: string) =>
    (await collection()).deleteOne({ _id: idOf(parishSlug, month) } as never);

/** Месяцы, которые приход уже опубликовал, — новейшие первыми. */
export const publishedMonths = async (parishSlug: string) =>
    (await collection())
        .find({ parishSlug, status: "published" })
        .project({ month: 1, publishedAt: 1 })
        .sort({ month: -1 })
        .toArray();

/**
 * Разошёлся ли снимок со свежим выводом — и в чём именно.
 *
 * Сравниваются часы и названия собраний по дням: остальное (память дня, пост,
 * глас) от нас не зависит и в расписании не главное. Возвращается список
 * чисел, а не «да/нет»: настоятелю надо знать, где смотреть.
 */
export const driftedDays = (snapshot: ParishDay[], fresh: ParishDay[]): string[] => {
    const key = (d: ParishDay) =>
        d.gatherings.map(g => `${g.time ?? "—"} ${g.title}`).join(" | ");
    const byDate = new Map(fresh.map(d => [d.date, key(d)]));
    return snapshot
        .filter(d => byDate.has(d.date) && byDate.get(d.date) !== key(d))
        .map(d => d.date);
};

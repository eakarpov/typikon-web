import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {isFinished, percentRead, type ProgressMark} from "@/lib/personal/progress";

// Отметки места чтения: typikon-users.readingProgress, одна запись на пару
// (кто, какой текст). Отметка перезаписывается, а не копится: история чтения —
// другая вещь и другой разговор о личных данных; здесь хранится ровно то, без
// чего нельзя продолжить.

const COLLECTION = "readingProgress";
const usersDb = async () => (await clientPromise).db("typikon-users");

export const saveProgress = async (userId: string, mark: ProgressMark): Promise<void> => {
    const db = await usersDb();
    const now = new Date();
    await db.collection(COLLECTION).updateOne(
        {userId, textId: mark.textId},
        {
            $set: {paragraph: mark.paragraph, total: mark.total, updatedAt: now},
            $setOnInsert: {userId, textId: mark.textId, startedAt: now},
        },
        {upsert: true},
    );
};

/** Убрать отметку: «я это читать не буду». Отсутствие записи — не ошибка. */
export const forgetProgress = async (userId: string, textId: string): Promise<void> => {
    const db = await usersDb();
    await db.collection(COLLECTION).deleteOne({userId, textId});
};

export interface ProgressRow {
    textId: string;
    /** Текст мог уйти из собрания после отметки: тогда имени нет, и это видно. */
    textName: string | null;
    /** Адрес чтения: alias, а нет его — идентификатор. */
    href: string | null;
    paragraph: number;
    total: number;
    percent: number;
    finished: boolean;
    updatedAt: Date;
}

/**
 * Последние отметки, свежие сверху. Дочитанное по умолчанию не показывается:
 * вопрос страницы — «что продолжить», а не «что я читал».
 *
 * Имена лежат в другой базе и дотягиваются вторым запросом — как в избранном.
 */
export const recentProgress = async (
    userId: string, limit = 5, withFinished = false,
): Promise<ProgressRow[]> => {
    const client = await clientPromise;
    const rows = await client.db("typikon-users").collection(COLLECTION)
        .find({userId})
        .sort({updatedAt: -1})
        .limit(withFinished ? limit : limit * 4)
        .toArray();

    const marks = rows
        .map((r) => ({
            textId: r.textId as string, paragraph: r.paragraph as number,
            total: r.total as number, updatedAt: r.updatedAt as Date,
        }))
        .filter((m) => withFinished || !isFinished(m))
        .slice(0, limit);

    const ids = marks.map((m) => m.textId).filter((id) => ObjectId.isValid(id));
    const texts = ids.length
        ? await client.db("typikon").collection("texts")
            .find({_id: {$in: ids.map((id) => new ObjectId(id))}}, {projection: {name: 1, alias: 1}})
            .toArray()
        : [];
    const byId = new Map(texts.map((t) => [t._id.toString(), t]));

    return marks.map((m) => {
        const text = byId.get(m.textId);
        return {
            ...m,
            textName: (text?.name as string | undefined) ?? null,
            href: text ? `/reading/${text.alias || m.textId}` : null,
            percent: percentRead(m),
            finished: isFinished(m),
        };
    });
};

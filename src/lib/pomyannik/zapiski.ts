import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { expiresAt, snapshot, validateNote, type NoteName } from "@/lib/pomyannik/note";
import { spanOf } from "@/lib/pomyannik/note";
import type { NoteKind } from "@/lib/pomyannik/types";

// ЗАПИСКИ, ПОДАННЫЕ СВЯЩЕННИКУ.
//
// Коллекция зовётся `zapiski` по-русски и нарочно: `typikon.notes` — это
// редакторские сноски, `userNotes` — личные заметки к тексту, и третье «notes»
// в том же проекте читалось бы наугад.
//
// ИМЕНА В ЗАПИСКЕ — СНИМОК помянника на минуту подачи, а не ссылки на него
// (см. note.snapshot): подавший потом правит свой список, а поданное меняться
// не должно.
//
// ЗАПИСКА НЕ ВЕЧНАЯ. В ней имена третьих лиц — людей, которые этого сайта не
// выбирали, — и после поминовения держать их не за что: у подавшего они лежат в
// помяннике, священнику они больше не нужны. Стирает их скрипт
// (npm run pomyannik:sweep), а не TTL-индекс: в ensure-indexes прямо сказано,
// что удаление данных индексом мы не заводим, и решать это хозяину базы.

const collection = async () =>
    (await clientPromise).db("typikon-users").collection("zapiski");

export interface Zapiska {
    id?: string;
    fromUserId: string;
    /** Кому подана — userId принимающего. */
    toUserId: string;
    kind: NoteKind;
    names: NoteName[];
    /** Сколько имён было. Переживает чистку, когда сами имена уже стёрты. */
    namesCount: number;
    /** Срок длящегося поминовения. У разового null. */
    span: { from: string; to: string } | null;
    createdAt: Date;
    /** Прочитана священником. */
    readAt: Date | null;
    /** Длящееся поминовение окончено — отмечает он же. */
    finishedAt: Date | null;
    /** Имена стёрты чисткой: осталась одна запись о том, что и когда подавали. */
    sweptAt: Date | null;
}

const out = (doc: any): Zapiska => {
    const { _id, ...rest } = doc;
    return { ...rest, id: String(_id) } as Zapiska;
};

/**
 * Подать записку.
 *
 * Проверка «кого можно вписать» стоит ЗДЕСЬ, а не только на странице: страницу
 * можно обойти, а панихида о живых — не опечатка в форме, а то, что священник
 * получит и не сможет отслужить.
 */
export const sendNote = async (
    fromUserId: string,
    toUserId: string,
    kind: NoteKind,
    persons: Array<Parameters<typeof snapshot>[0]>,
    slavonic: Record<string, { genitive: string; source: "lexicon" | "accents" | "plain" }>,
): Promise<Zapiska> => {
    const names = validateNote(kind, persons.map(p =>
        snapshot(p, slavonic[p.churchName || p.name] ?? null)));

    const createdAt = new Date();
    const doc: Omit<Zapiska, "id"> = {
        fromUserId, toUserId, kind, names, namesCount: names.length,
        span: spanOf(kind, createdAt),
        createdAt, readAt: null, finishedAt: null, sweptAt: null,
    };
    const result = await (await collection()).insertOne(doc as any);
    return out({ ...doc, _id: result.insertedId });
};

/** Что подали этому священнику. Неразобранные сверху — за ними и приходят. */
export const notesFor = async (toUserId: string): Promise<Zapiska[]> => {
    const docs = await (await collection())
        .find({ toUserId })
        .sort({ readAt: 1, createdAt: -1 })
        .limit(500)
        .toArray();
    return docs.map(out);
};

/** Что подавал этот человек. После чистки останется запись без имён. */
export const notesFrom = async (fromUserId: string): Promise<Zapiska[]> => {
    const docs = await (await collection())
        .find({ fromUserId })
        .sort({ createdAt: -1 })
        .limit(200)
        .toArray();
    return docs.map(out);
};

export const countUnread = async (toUserId: string): Promise<number> =>
    (await collection()).countDocuments({ toUserId, readAt: null });

/**
 * Отметить прочитанной или оконченной.
 *
 * Принимающий — В ФИЛЬТРЕ: отметить чужую записку нельзя даже по угаданному
 * идентификатору. Прочтение не снимается обратно: «я это уже читал» — не то, о
 * чём стоит передумывать.
 */
export const markNote = async (
    toUserId: string, id: string, what: "read" | "finished",
): Promise<boolean> => {
    if (!ObjectId.isValid(id)) return false;
    const field = what === "read" ? "readAt" : "finishedAt";
    const result = await (await collection()).updateOne(
        { _id: new ObjectId(id), toUserId, [field]: null },
        { $set: { [field]: new Date() } },
    );
    return result.matchedCount > 0;
};

export interface SweepResult {
    /** Сколько записок лишились имён. */
    swept: number;
    /** Сколько ещё лежат с именами. */
    left: number;
}

/**
 * Чистка: снять имена с записок, чей срок вышел.
 *
 * ЗАПИСЬ ОСТАЁТСЯ, ИМЕНА УХОДЯТ. Стереть документ целиком было бы проще, но
 * тогда у обоих пропала бы история: подавший не вспомнит, заказывал ли он
 * сорокоуст и когда, а священник — сколько записок принял. Ни то ни другое не
 * требует имён, и потому остаётся счёт, а не перечень.
 */
export const sweepNotes = async (now = new Date()): Promise<SweepResult> => {
    const col = await collection();
    const alive = await col.find({ sweptAt: null }).toArray();

    const stale = alive.filter(doc => expiresAt(doc as any) <= now);
    for (const doc of stale) {
        await col.updateOne({ _id: doc._id }, { $set: { names: [], sweptAt: now } });
    }
    return { swept: stale.length, left: alive.length - stale.length };
};

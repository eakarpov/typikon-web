import { canSubmitNoteKind, SUBMISSION_KIND_MESSAGE } from './submissionKinds';
import { type NoteSubmission } from './priestSubmissions';
import { insertWithinWeeklyQuota } from './weeklyQuota';
import { SERVICE_KINDS } from './priestQueueRules';
import { dispatchWaiting, ensureQueueIndexes, markQueued, slotsOf, queueNotes } from './priestQueue';
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { NoteError, expiresAt, snapshot, validateNote, type NoteName } from "@/lib/pomyannik/note";
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
    queueRequested?: boolean;
    targetUserId?: string | null;
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
    slavonic: Record<string, { genitive: string; source: "lexicon" | "accents" | "plain" | "manual" }>,
    queue?: { targetUserId: string | null },
    submission?: NoteSubmission,
): Promise<Zapiska> => {
    if (!canSubmitNoteKind(kind)) throw new NoteError(SUBMISSION_KIND_MESSAGE);
    const names = validateNote(kind, persons.map(p =>
        snapshot(p, slavonic[p.churchName || p.name] ?? null)));

    const database = (await clientPromise).db('typikon-users');
    if (!queue && toUserId && SERVICE_KINDS.includes(kind as never)) {
        const priest = await database.collection('commemorators').findOne({ userId: toUserId, queueConfigured: true });
        if (priest) queue = { targetUserId: toUserId };
    }
    if (queue) {
        await ensureQueueIndexes(database);
        toUserId = '';
    }
    const createdAt = new Date();
    const doc: Omit<Zapiska, "id"> = {
        fromUserId, toUserId, kind, names, namesCount: names.length,
        span: spanOf(kind, createdAt),
        createdAt, readAt: null, finishedAt: null, sweptAt: null,
        ...(queue ? { queueRequested: true, targetUserId: queue.targetUserId } : {}),
    };
    const note = out(await insertWithinWeeklyQuota(database, doc, submission));
    // Submission shares the oldest-first allocator with cron; it cannot jump
    // ahead of notes accumulated while no service could receive them.
    if (queue) await dispatchWaiting(database);
    return note;
};

/** Что подали этому священнику. Неразобранные сверху — за ними и приходят. */
export const notesFor = async (toUserId: string): Promise<Zapiska[]> => {
    const docs = await (await collection())
        .find({ toUserId })
        .sort({ readAt: 1, createdAt: -1 })
        .limit(500)
        .toArray();
    const database = (await clientPromise).db('typikon-users');
    const slots = await slotsOf(database).find({ userId: toUserId }).toArray();
    const queued = (await Promise.all(slots.map(s => queueNotes(database, s)))).flat() as any[];
    return [...docs.map(out), ...queued].sort((a, b) => Number(!!a.readAt) - Number(!!b.readAt));
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
    (await notesFor(toUserId)).filter(n => !n.readAt).length;

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
    if (what === 'read' && await markQueued((await clientPromise).db('typikon-users'), toUserId, id)) return true;
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

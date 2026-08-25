import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";

// Избранное пользователя — отдельная коллекция, а не поле в userNotes.
//
// Это разные вещи: заметка несёт содержимое и место внутри текста (абзац или
// стих плюс саму фразу), избранное — голая отметка «этот текст мне важен».
// Общее у них только то, что и там и там есть пара (кто, какой текст).
//
// Живёт в typikon-users, рядом с sessions и userNotes; favourites.textId
// ссылается на typikon.texts._id — другая база.

const usersDb = async () => (await clientPromise).db("typikon-users");

/**
 * Добавляет текст в избранное. Идемпотентно: повторный вызов не плодит записей
 * и не считается ошибкой — приложение имеет право переслать отметку из своей
 * офлайн-очереди, не зная, дошла ли предыдущая попытка.
 */
export const addFavourite = async (userId: string, textId: string) => {
    if (!ObjectId.isValid(textId)) return false;
    const db = await usersDb();
    await db.collection("favourites").updateOne(
        {userId, textId},
        {$setOnInsert: {userId, textId, createdAt: new Date()}},
        {upsert: true},
    );
    return true;
};

/**
 * Убирает текст из избранного. Тоже идемпотентно: отсутствие записи — не 404,
 * а нормальный исход. Пользователь хотел, чтобы текста в избранном не было, —
 * его там нет.
 */
export const removeFavourite = async (userId: string, textId: string) => {
    if (!ObjectId.isValid(textId)) return false;
    const db = await usersDb();
    await db.collection("favourites").deleteOne({userId, textId});
    return true;
};

/**
 * Вливает список с устройства, ничего не удаляя.
 *
 * Именно слияние, а не замена: человек мог отмечать тексты и до входа в
 * аккаунт, и с другого устройства. Ни та, ни другая сторона не должна
 * пропасть, а порядок отметок сохраняется по createdAt.
 */
export const mergeFavourites = async (userId: string, textIds: string[]) => {
    if (textIds.length === 0) return;
    const db = await usersDb();
    const now = new Date();
    await db.collection("favourites").bulkWrite(
        textIds.map((textId) => ({
            updateOne: {
                filter: {userId, textId},
                update: {$setOnInsert: {userId, textId, createdAt: now}},
                upsert: true,
            },
        })),
        {ordered: false},
    );
};

/**
 * Список избранного, новые сверху.
 *
 * Имена текстов лежат в другой базе, а $lookup между базами на community
 * MongoDB ненадёжен, поэтому дотягиваем их отдельным запросом и мёрджим
 * руками — так же, как в getAllUserNotes.
 *
 * Текст мог быть удалён из собрания уже после того, как его отметили: такие
 * записи возвращаются с textName: null, а не молча пропадают, иначе избранное
 * уменьшалось бы само по себе без объяснения.
 */
export const getFavourites = async (userId: string) => {
    const client = await clientPromise;
    const db = client.db("typikon-users");
    const rows = await db.collection("favourites")
        .find({userId})
        .sort({createdAt: -1})
        .toArray();

    const textIds = [...new Set(rows.map((r) => r.textId as string))].filter((id) => ObjectId.isValid(id));
    let names: Record<string, string> = {};
    if (textIds.length > 0) {
        const texts = await client.db("typikon").collection("texts")
            .find({_id: {$in: textIds.map((id) => new ObjectId(id))}}, {projection: {name: 1}})
            .toArray();
        names = Object.fromEntries(texts.map((t) => [t._id.toString(), t.name]));
    }

    return rows.map((r) => ({
        textId: r.textId as string,
        textName: names[r.textId as string] ?? null,
        createdAt: r.createdAt,
    }));
};

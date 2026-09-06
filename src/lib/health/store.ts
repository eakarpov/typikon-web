import clientPromise from "@/lib/mongodb";
import type { HealthSnapshot } from "@/lib/health/core";

// Снимки панели: чтобы видеть не только «сколько дыр», но и «сколько закрыто».
//
// ПОЧЕМУ СНИМКАМИ, А НЕ ЖУРНАЛОМ ПРАВОК. Журнал отвечал бы точнее, но его
// пришлось бы вести в каждом месте, где что-то доразмечают, — в админке, в
// скриптах импорта, в разборе книг соседнего репозитория. Снимок же снимается
// одной командой снаружи и ничего не требует от остального кода. Цена —
// разрешение: между снимками не видно, что происходило внутри.
//
// Снимки не чистятся: их по десятку в год, а год — тот срок, на котором
// вопрос «стало ли лучше» вообще имеет смысл.

export const SNAPSHOTS_COLLECTION = "health_snapshots";

const collection = async () =>
    (await clientPromise).db("typikon").collection(SNAPSHOTS_COLLECTION);

/** Последний снимок; null — их ещё не делали. */
export const lastSnapshot = async (): Promise<HealthSnapshot | null> => {
    const doc = await (await collection())
        .find({}, { sort: { takenAt: -1 }, limit: 1 })
        .toArray();
    if (!doc.length) return null;
    const { _id, ...rest } = doc[0] as any;
    return rest as HealthSnapshot;
};

/** Снимок под ключом дня: два прогона в один день — это один снимок, не два. */
export const saveSnapshot = async (snapshot: HealthSnapshot): Promise<void> => {
    const day = snapshot.takenAt.slice(0, 10);
    await (await collection()).updateOne(
        { _id: day as never },
        { $set: snapshot },
        { upsert: true },
    );
};

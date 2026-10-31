import { ObjectId, type Db, type Document, type WithId } from "mongodb";

/** Старые карточки остаются в базе как ссылки: их ID и алиасы не освобождаются. */
export async function resolveDayAddress(db: Db, address: string) {
    const initial = await db.collection("days").findOne(ObjectId.isValid(address)
        ? { _id: new ObjectId(address) } : { alias: address },
    { projection: { alias: 1, redirectTo: 1, weekId: 1 } });
    if (!initial) return null;
    let day: WithId<Document> = initial;
    const visited = new Set<string>();
    while (day.redirectTo) {
        const key = String(day._id);
        if (visited.has(key) || visited.size >= 8) throw new Error("Цикл перенаправлений дня");
        visited.add(key);
        if (!ObjectId.isValid(day.redirectTo)) throw new Error("Неверная цель перенаправления дня");
        const next: WithId<Document> | null = await db.collection("days").findOne({ _id: new ObjectId(day.redirectTo) },
            { projection: { alias: 1, redirectTo: 1, weekId: 1 } });
        if (!next) throw new Error("Цель перенаправления дня отсутствует");
        day = next;
    }
    if (!visited.size) return { id: day._id, redirectPath: null };
    const week = day.weekId ? await db.collection("weeks").findOne({ _id: day.weekId },
        { projection: { penticostration: 1, triodion: 1 } }) : null;
    const section = week?.penticostration ? "penticostarion" : week?.triodion ? "triodion" : "calendar";
    return { id: day._id, redirectPath: `/${section}/${day.alias || day._id}` };
}

// Святые дня из нашего каталога: памяти Минеи на церковное число и выверенные
// человеком связи с ними (memory_saint_links, см. getLinkedSaint).
import clientPromise from "@/lib/mongodb";
import { cached, CacheTag, CONTENT_REVALIDATE } from "@/lib/cache";
import { getLinkedSaint } from "@/lib/memories";
import { churchMonthDay, daySaintsOf, type LinkedSaint } from "./core";

// Связей выверено меньше чем в половине случаев, и пустой ответ чаще значит
// «связь не проставлена», чем «святых нет». Поэтому кэш сбрасывается всеми
// тремя тегами: правка связи, перезаливка реестра памятей и правка записи
// святого меняют ответ порознь.
export const daySaintsCached = cached(async (dateStr: string) => {
    const md = churchMonthDay(dateStr);
    if (!md) return [];

    const db = (await clientPromise).db("typikon");
    const memories = await db.collection("memories")
        .find({ book: "menaion", month: md.month, day: md.day }, { projection: { _id: 1 } })
        .sort({ _id: 1 })
        .toArray();

    const linked: LinkedSaint[] = await Promise.all(memories.map(async (row) => {
        const memoryId = String(row._id);
        return { memoryId, saint: await getLinkedSaint(memoryId) };
    }));

    return daySaintsOf(linked);
}, ["calendar-day-saints"], [CacheTag.DAYS, CacheTag.MEMORIES, CacheTag.SAINTS], CONTENT_REVALIDATE);

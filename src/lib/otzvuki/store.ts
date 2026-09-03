import clientPromise from "@/lib/mongodb";
import { cached, CacheTag } from "@/lib/cache";
import { rulesDb } from "@/lib/rulesDb";
import type { BookStats, CitationSummary, CorpusStamp, TopStats } from "@/lib/otzvuki/core";

// Готовый свод из Монги. Считает его не сайт, а скрипт (см.
// src/scripts/build-citation-stats.ts), и вот почему.
//
// Полный проход по scripture_citations — 531 263 строки — занимает 5,7 с, и
// это не тот случай, где помогает индекс: группировка по книге читает таблицу
// целиком. Остальные разделы корпуса читают SQLite синхронно прямо в рендере
// (см. /chants, /incipits) и обходятся без кэша, потому что там выборка — это
// страница выдачи, десятки строк. Здесь выборка — вся таблица, и держать её в
// запросе значило бы платить шесть секунд за каждый заход.
//
// Оттого и Монга, а не память процесса: свод переживает перезапуск, одинаков
// на всех процессах и сбрасывается тем же тегом, что и прочие выборки. Цена —
// лишний шаг в выкладке: после rules-db-release.sh надо пересчитать свод,
// иначе он описывает корпус, которого на сервере уже нет. Чтобы это было
// видно, а не догадывалось, сводка носит отпечаток файла корпуса.

export const STATS_COLLECTION = "citation_stats";
export const SUMMARY_ID = "summary";
export const TOP_ID = "top";

const collection = async () =>
    (await clientPromise).db("typikon").collection(STATS_COLLECTION);

// Документ книги хранится под собственным canonId, а сводка и топ — под
// служебными ключами. Разводить их по коллекциям незачем: читаются они всегда
// вместе, а пересчитываются одним прогоном.
const readSummary = async (): Promise<CitationSummary | null> => {
    const doc = await (await collection()).findOne({ _id: SUMMARY_ID as never });
    if (!doc) return null;
    const { _id, ...rest } = doc as any;
    return rest as CitationSummary;
};

const readBook = async (canonId: string): Promise<BookStats | null> => {
    const doc = await (await collection()).findOne({ _id: canonId as never });
    if (!doc) return null;
    const { _id, ...rest } = doc as any;
    return rest as BookStats;
};

// Книг 86, и вместе с картами глав это мегабайты. Своду нужны одни итоги,
// поэтому карта и молчащие отрезки из выборки списка исключены проекцией:
// страница книги дочитает их своим запросом.
const readBooks = async (): Promise<BookStats[]> => {
    const docs = await (await collection())
        .find(
            { _id: { $nin: [SUMMARY_ID, TOP_ID] } as never },
            { projection: { chapters: 0, silent: 0 } },
        )
        .toArray();
    return docs.map((doc) => {
        const { _id, ...rest } = doc as any;
        return rest as BookStats;
    });
};

const readTop = async (): Promise<TopStats | null> => {
    const doc = await (await collection()).findOne({ _id: TOP_ID as never });
    if (!doc) return null;
    const { _id, ...rest } = doc as any;
    return rest as TopStats;
};

export const citationSummary = cached(readSummary, ["otzvuki-summary"], [CacheTag.CITATIONS]);
export const citationBooks = cached(readBooks, ["otzvuki-books"], [CacheTag.CITATIONS]);
export const citationBook = cached(readBook, ["otzvuki-book"], [CacheTag.CITATIONS]);
export const citationTop = cached(readTop, ["otzvuki-top"], [CacheTag.CITATIONS]);

// Отпечаток лежащего рядом корпуса — чтобы страница могла сказать, что свод
// описывает уже не его. Три `max()` по первичным ключам: они едут внутри файла
// и сдвигаются с каждой пересборкой, в отличие от времени правки, которое
// выкладка архивом округляет и переставляет. Стоят миллисекунды.
//
// Корпуса на сервере может не быть вовсе — тогда сравнивать не с чем, и это не
// ошибка: свод в Монге лежит и читается сам по себе.
export const corpusStamp = (): CorpusStamp | null => {
    const db = rulesDb();
    if (!db) return null;
    try {
        const row = db.prepare(`
            SELECT (SELECT max(item_id) FROM content_items) AS items,
                   (SELECT max(group_id) FROM groups) AS groups,
                   (SELECT max(rowid) FROM scripture_citations) AS citations
        `).get() as { items: number; groups: number; citations: number } | undefined;
        if (!row) return null;
        return { items: row.items ?? 0, groups: row.groups ?? 0, citations: row.citations ?? 0 };
    } catch {
        // Слоя цитат в этой сборке может не быть — тогда отпечатка нет тоже.
        return null;
    }
};

/** Тот ли это корпус, по которому свод посчитан. Без одной из сторон — не судим. */
export const stampMatches = (stamp: CorpusStamp | null, now: CorpusStamp | null): boolean =>
    !stamp || !now
    || (stamp.items === now.items && stamp.groups === now.groups && stamp.citations === now.citations);

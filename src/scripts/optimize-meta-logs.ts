// Приводит журнал посещений в порядок: наполняет коллекцию посетителей, схлопывает
// адреса и сворачивает старые подробности в помесячные итоги.
//
// Зачем: журнал — это строка на пару (посетитель, адрес), и он растёт без конца.
// На проде накопилось около 95 тысяч записей, а метрика на странице Триоди при этом
// считалась загрузкой всех документов в память.
//
// Что делает, по шагам:
//
//   1. visitors — по документу на посетителя. Ради этого шага дальше можно чистить
//      подробности, не теряя цифру «сколько всего посетителей»: она берётся отсюда.
//
//   2. Схлопывает адреса. Раньше писался адрес целиком, поэтому один раздел
//      размножался: http и https, с www и без, с ?query и без. Остаётся путь,
//      совпавшие строки сливаются (просмотры складываются).
//
//   3. Сворачивает подробности старше N дней в один документ на месяц:
//      {kind: "summary", month: "2026-08", views, urls}. Сумма просмотров сохраняется
//      точно, подробности по парам за тот месяц удаляются.
//
// Метрики после свёртки: «посещения» точны (итоги хранят суммы), «посетители» точны
// (считаются по visitors, а не по журналу).
//
// Запуск:
//   npm run db:optimize-logs                    # что будет сделано
//   npm run db:optimize-logs -- --apply         # применить, свернуть старше 180 дней
//   npm run db:optimize-logs -- --apply --keep-days 90
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { LOGS, VISITORS, VISITS_DB, monthKey, normalizeUrl } from "@/lib/meta/visits";

const APPLY = process.argv.includes("--apply");
const KEEP_DAYS = (() => {
    const i = process.argv.indexOf("--keep-days");
    const n = i === -1 ? NaN : parseInt(process.argv[i + 1] ?? "", 10);
    return Number.isFinite(n) && n > 0 ? n : 180;
})();

const mb = (bytes: number) => `${(bytes / 1048576).toFixed(1)} МБ`;

async function main() {
    const client = await clientPromise;
    const db = client.db(VISITS_DB);
    const logs = db.collection(LOGS);
    const visitors = db.collection(VISITORS);

    const before = await db.command({ collStats: LOGS });
    const cutoff = new Date(Date.now() - KEEP_DAYS * 24 * 3600 * 1000);

    console.log(`Журнал: ${before.count} записей, ${mb(before.size)} (+ индексы ${mb(before.totalIndexSize)})`);
    console.log(`Свёртка коснётся записей старше ${cutoff.toISOString().slice(0, 10)} (${KEEP_DAYS} дн.)\n`);

    // --- 1. Посетители
    const knownVisitors = await visitors.estimatedDocumentCount();
    const allHashes = await logs.distinct("ipHash", { kind: { $ne: "summary" } });
    console.log(`1. Посетители: в журнале ${allHashes.length}, в коллекции visitors ${knownVisitors}`);

    if (APPLY && allHashes.length) {
        const now = new Date();
        await visitors.bulkWrite(
            allHashes.filter(Boolean).map((hash) => ({
                updateOne: {
                    filter: { _id: hash },
                    update: { $setOnInsert: { firstSeen: now, lastSeen: now } },
                    upsert: true,
                },
            })),
            { ordered: false },
        );
        console.log(`   записано: ${await visitors.estimatedDocumentCount()}`);
    }

    // --- 2. Схлопывание адресов
    const details = await logs
        .find({ kind: { $ne: "summary" } }, { projection: { ipHash: 1, url: 1, count: 1, wasAt: 1, userAgents: 1 } })
        .toArray();

    type Merged = { ipHash: string; url: string; count: number; wasAt: Date[]; userAgents: string[]; ids: any[] };
    const merged = new Map<string, Merged>();
    for (const doc of details) {
        const url = normalizeUrl(doc.url);
        const key = `${doc.ipHash}|${url}`;
        const entry: Merged = merged.get(key) ?? { ipHash: doc.ipHash, url, count: 0, wasAt: [], userAgents: [], ids: [] };
        entry.count += doc.count ?? 0;
        entry.wasAt.push(...(doc.wasAt ?? []));
        entry.userAgents.push(...(doc.userAgents ?? []));
        entry.ids.push(doc._id);
        merged.set(key, entry);
    }

    const collapsible = [...merged.values()].filter((e) => e.ids.length > 1);
    const rowsSaved = details.length - merged.size;
    console.log(`2. Адреса: ${details.length} строк схлопываются в ${merged.size} (минус ${rowsSaved})`);
    if (collapsible.length) {
        console.log(`   пример: ${collapsible[0].url} — было ${collapsible[0].ids.length} строк`);
    }

    if (APPLY && rowsSaved > 0) {
        for (const entry of merged.values()) {
            const [keep, ...drop] = entry.ids;
            await logs.updateOne(
                { _id: keep },
                {
                    $set: {
                        url: entry.url,
                        count: entry.count,
                        wasAt: entry.wasAt.sort((a, b) => +a - +b).slice(-50),
                        userAgents: [...new Set(entry.userAgents)].filter(Boolean),
                    },
                },
            );
            if (drop.length) await logs.deleteMany({ _id: { $in: drop } });
        }
        console.log(`   схлопнуто`);
    }

    // --- 3. Свёртка старых подробностей в помесячные итоги
    const old = await logs.find(
        { kind: { $ne: "summary" } },
        { projection: { count: 1, url: 1, wasAt: 1 } },
    ).toArray();

    type Bucket = { views: number; urls: Set<string>; ids: any[] };
    const byMonth = new Map<string, Bucket>();
    for (const doc of old) {
        const last = (doc.wasAt ?? []).slice(-1)[0];
        const seen = last ? new Date(last) : null;
        if (!seen || seen >= cutoff) continue;

        const key = monthKey(seen);
        const bucket: Bucket = byMonth.get(key) ?? { views: 0, urls: new Set<string>(), ids: [] };
        bucket.views += doc.count ?? 0;
        bucket.urls.add(normalizeUrl(doc.url));
        bucket.ids.push(doc._id);
        byMonth.set(key, bucket);
    }

    const toRollUp = [...byMonth.values()].reduce((n, b) => n + b.ids.length, 0);
    console.log(`3. Свёртка: ${toRollUp} записей за ${byMonth.size} мес. схлопываются в ${byMonth.size} итогов`);
    for (const [month, bucket] of [...byMonth.entries()].sort()) {
        console.log(`   ${month}: ${bucket.ids.length} записей, ${bucket.views} просмотров, ${bucket.urls.size} адресов`);
    }

    if (!APPLY) {
        console.log(`\nНичего не изменено. Для применения: --apply`);
        process.exit(0);
    }

    for (const [month, bucket] of byMonth) {
        await logs.updateOne(
            { kind: "summary", month },
            {
                $inc: { views: bucket.views },
                $set: { urls: bucket.urls.size, rolledUpAt: new Date() },
            },
            { upsert: true },
        );
        await logs.deleteMany({ _id: { $in: bucket.ids } });
    }

    const after = await db.command({ collStats: LOGS });
    console.log(`\nСтало: ${after.count} записей, ${mb(after.size)}`);
    console.log(`Освобождено: ${before.count - after.count} записей, ${mb(before.size - after.size)}`);
    console.log(`Посетителей в отдельной коллекции: ${await visitors.estimatedDocumentCount()}`);
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

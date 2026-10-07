// Массовая выверка престолов по уверенности разбора: принять всё, что разбор
// назвал достаточно надёжно (по умолчанию — 0.7 и выше).
//
// ЗАЧЕМ ОТДЕЛЬНЫЙ ШАГ. Разбор престола ложится догадкой со статусом `pending`, и
// выверять его глазами можно в @/app/admin/prestoly. Когда догадок десятки тысяч,
// а словарь уже отлажен, разумно принять разом самые надёжные — но это решение
// политики, а не свойство разбора, и потому оно здесь, отдельной ручкой с
// порогом, а не зашито в разбор.
//
// ЧТО ЗНАЧИТ УВЕРЕННОСТЬ. У разбора имени (@/scripts/match-temple-dedications)
// 0.9 — точный образец словаря и других посвящений в имени нет; 0.6 — точный
// образец, но имя называет и другие; 0.5 и 0.3 — короткая основа. У разбора
// прозы (@/lib/pilgrimage/prestoly) 0.8–0.85 — точный образец, 0.5 — основа.
// У привоза «Соборов.ру» уверенность ровно 0.7: престол взят из явного поля
// свода. Порог 0.7 берёт, стало быть, и весь привоз свода, и точные образцы.
//
// ПРИНЯТО МАШИНОЙ — ЭТО ВИДНО. Принятому ставится `approvedBy: "auto:0.7"` (с
// порогом), `approvedAt` и `reviewedAt`: такое принятие можно отличить от
// выверки человеком и откатить тем же порогом в обратную сторону.
//
// Запуск:
//   npm run temples:approve                                  # показать
//   npm run temples:approve -- --write
//   npm run temples:approve -- --min-confidence 0.85 --source sobory
// Ключи: --min-confidence 0.7, --source sobory,site,name,name-secondary,
//        --json файл.json
import "@/scripts/lib/env";
import { writeFileSync } from "node:fs";
import clientPromise from "@/lib/mongodb";

const arg = (name: string, fallback: string) => {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : fallback;
};
const flag = (name: string) => process.argv.includes(`--${name}`);

const MIN = Number(arg("min-confidence", "0.7"));
const SOURCES = arg("source", "").split(",").map((s) => s.trim()).filter(Boolean);
const JSON_OUT = arg("json", "");
const WRITE = flag("write");
const TAG = `auto:${MIN}`;

const main = async () => {
    if (!Number.isFinite(MIN)) {
        console.error("порог уверенности не число");
        process.exit(1);
    }

    const client = await clientPromise;
    const temples = client.db("typikon").collection("temples");

    // Что будет взято: считаем по самим престолам, а не по храмам.
    const rows = await temples.aggregate([
        { $unwind: "$prestoly" },
        {
            $match: {
                "prestoly.status": "pending",
                "prestoly.confidence": { $gte: MIN },
                ...(SOURCES?.length ? { "prestoly.source": { $in: SOURCES } } : {}),
            },
        },
        {
            $group: {
                _id: "$prestoly.source",
                n: { $sum: 1 },
                main: { $sum: { $cond: ["$prestoly.isMain", 1, 0] } },
                low: { $min: "$prestoly.confidence" },
                high: { $max: "$prestoly.confidence" },
            },
        },
        { $sort: { n: -1 } },
    ], { allowDiskUse: true }).toArray();

    const total = rows.reduce((n, r) => n + r.n, 0);
    console.log(`порог уверенности: ${MIN}${SOURCES?.length ? `; источники: ${SOURCES.join(", ")}` : "; все источники"}`);
    for (const r of rows as any[]) {
        console.log(`  ${String(r.n).padStart(6)}  ${r._id ?? "—"}  (главных ${r.main}, уверенность ${r.low}–${r.high})`);
    }
    console.log(`итого престолов к принятию: ${total}`);

    if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ min: MIN, sources: SOURCES, rows }, null, 2));

    if (!WRITE) {
        console.log("\nхолостой прогон — ничего не пишется (--write чтобы принять)");
        await client.close();
        return;
    }

    const now = new Date();
    const res = await temples.updateMany(
        {
            prestoly: {
                $elemMatch: {
                    status: "pending",
                    confidence: { $gte: MIN },
                    ...(SOURCES?.length ? { source: { $in: SOURCES } } : {}),
                },
            },
        },
        {
            $set: {
                "prestoly.$[p].status": "approved",
                "prestoly.$[p].approvedBy": TAG,
                "prestoly.$[p].approvedAt": now,
                "prestoly.$[p].reviewedAt": now,
            },
        },
        {
            arrayFilters: [{
                "p.status": "pending",
                "p.confidence": { $gte: MIN },
                ...(SOURCES?.length ? { "p.source": { $in: SOURCES } } : {}),
            }],
        },
    );

    const left = await temples.aggregate([
        { $unwind: "$prestoly" },
        { $match: { "prestoly.status": "approved", "prestoly.approvedBy": TAG } },
        { $count: "n" },
    ]).toArray();

    console.log(`\nпринято престолов: ${total} (храмов затронуто: ${res.modifiedCount})`);
    console.log(`с меткой «${TAG}» теперь: ${(left[0] as any)?.n ?? 0}; осталось ждать разбора: см. /admin/prestoly`);
    await client.close();
};

main().catch((e) => { console.error(e); process.exit(1); });

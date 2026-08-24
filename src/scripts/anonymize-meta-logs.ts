// Приводит накопленный журнал просмотров к новому виду: заменяет сырой IP хэшем
// и подрезает разросшиеся массивы отметок времени.
//
// Зачем: /api/meta считает только сумму просмотров и число различных посетителей —
// для второго достаточно хэша, а хранить адреса посетителей незачем. Плюс поле wasAt
// росло без предела и на популярных адресах тянуло документ к пределу размера.
//
// Запускать один раз после выкладки: новые записи пишутся уже правильно
// (см. writeMetaData в src/app/api.ts). Скрипт идемпотентный — записи, где ipHash
// уже стоит, пропускаются.
//
// Соль берётся из META_HASH_SALT, а если её нет — из SESSION_SECRET; та же логика,
// что в приложении, иначе старые и новые записи разойдутся и посетители посчитаются
// дважды.
//
// Запуск:
//   npx tsx src/scripts/anonymize-meta-logs.ts           # что будет сделано
//   npx tsx src/scripts/anonymize-meta-logs.ts --apply   # переписать
import "@/scripts/lib/env";
import { createHash } from "node:crypto";
import clientPromise from "@/lib/mongodb";

const APPLY = process.argv.includes("--apply");
const TIMESTAMPS_KEPT = 50;

const hashIp = (ip: unknown): string => {
    const salt = process.env.META_HASH_SALT || process.env.SESSION_SECRET || "";
    return createHash("sha256").update(`${salt}:${String(ip ?? "")}`).digest("hex").slice(0, 16);
};

async function main() {
    const client = await clientPromise;
    const logs = client.db("typikon-meta").collection("logs");

    const total = await logs.countDocuments();
    const withRawIp = await logs.countDocuments({ ip: { $exists: true } });
    const alreadyHashed = await logs.countDocuments({ ipHash: { $exists: true } });

    const longest = await logs.aggregate([
        { $project: { size: { $size: { $ifNull: ["$wasAt", []] } } } },
        { $sort: { size: -1 } },
        { $limit: 1 },
    ]).toArray();

    console.log(`Записей: ${total}`);
    console.log(`  с сырым IP: ${withRawIp}`);
    console.log(`  уже с хэшем: ${alreadyHashed}`);
    console.log(`  самый длинный массив отметок: ${longest[0]?.size ?? 0} (оставим не больше ${TIMESTAMPS_KEPT})`);

    if (!withRawIp) {
        console.log(`\nПереписывать нечего.`);
        process.exit(0);
    }

    if (!APPLY) {
        console.log(`\nНичего не изменено. Для записи: --apply`);
        process.exit(0);
    }

    // Разные документы одного посетителя (один IP, разные URL) дают разные ключи —
    // схлопывать записи не нужно, достаточно заменить поле в каждой.
    const cursor = logs.find({ ip: { $exists: true } }, { projection: { ip: 1, wasAt: 1 } });
    let done = 0;

    while (await cursor.hasNext()) {
        const doc = await cursor.next();
        if (!doc) break;

        const wasAt = Array.isArray(doc.wasAt) ? doc.wasAt.slice(-TIMESTAMPS_KEPT) : [];

        await logs.updateOne(
            { _id: doc._id },
            {
                $set: { ipHash: hashIp(doc.ip), wasAt },
                $unset: { ip: "" },
            },
        );

        done++;
        if (done % 500 === 0) console.log(`  ...${done}/${withRawIp}`);
    }

    console.log(`\nПереписано записей: ${done}. Сырых адресов в журнале не осталось.`);
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

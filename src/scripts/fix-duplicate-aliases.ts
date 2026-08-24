// Разводит документы с одинаковым alias: каждому в группе дописывается номер — -1, -2, -3.
//
// Зачем: адрес /reading/{alias} (и /calendar/{alias}, /triodion/{alias},
// /penticostarion/{alias}) разрешается ровно в один документ, поэтому из пары с общим
// alias второй недостижим — на сайт он не выведен никак. Заводить новые такие пары уже
// не даёт проверка в админке (POST /api/admin/texts/[id], /api/admin/days/[id]),
// этот скрипт разбирает накопленные.
//
// Внимание: адреса меняются у ВСЕХ документов группы, включая тот, что сейчас
// открывается по короткому alias. Старые адреса перестанут открываться.
//
// Порядок номеров детерминирован: для текстов по bookIndex (то есть по порядку в книге),
// для дней по monthIndex/weekIndex, дальше по _id — чтобы повторный прогон не перетасовал
// уже проставленные номера.
//
// Запуск:
//   npx tsx src/scripts/fix-duplicate-aliases.ts           # план, ничего не меняет
//   npx tsx src/scripts/fix-duplicate-aliases.ts --apply   # переименовать
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { revalidateContent } from "@/scripts/lib/revalidate";

const APPLY = process.argv.includes("--apply");

type Doc = {
    _id: any;
    alias: string;
    name?: string;
    bookIndex?: number;
    monthIndex?: number;
    weekIndex?: number;
};

const orderKey = (d: Doc) => {
    const idx = d.bookIndex ?? d.monthIndex ?? d.weekIndex;
    return idx == null ? Number.MAX_SAFE_INTEGER : idx;
};

async function main() {
    const client = await clientPromise;
    const db = client.db("typikon");

    let planned = 0;
    let renamed = 0;
    const renames: Array<{ collection: string; id: string; from: string; to: string }> = [];

    for (const collection of ["texts", "days"]) {
        const groups = await db.collection(collection).aggregate([
            { $match: { alias: { $nin: ["", null] } } },
            { $group: { _id: "$alias", n: { $sum: 1 }, ids: { $push: "$_id" } } },
            { $match: { n: { $gt: 1 } } },
            { $sort: { _id: 1 } },
        ]).toArray();

        console.log(`\n=== ${collection}: групп с общим alias — ${groups.length} ===`);

        for (const group of groups) {
            const docs = (await db.collection(collection)
                .find({ _id: { $in: group.ids } })
                .project({ alias: 1, name: 1, bookIndex: 1, monthIndex: 1, weekIndex: 1 })
                .toArray()) as Doc[];

            docs.sort((a, b) => (orderKey(a) - orderKey(b)) || String(a._id).localeCompare(String(b._id)));

            console.log(`\n  ${group._id} ×${docs.length}`);

            for (let i = 0; i < docs.length; i++) {
                const doc = docs[i];
                const candidate = `${group._id}-${i + 1}`;

                // Номер мог уже быть занят другим документом — тогда не молчим, а пропускаем:
                // лучше оставить пару неразведённой, чем создать новую коллизию.
                const taken = await db.collection(collection).findOne({
                    alias: candidate,
                    _id: { $ne: doc._id },
                });
                if (taken) {
                    console.log(`    ! ${candidate} уже занят — пропускаю «${(doc.name || "").slice(0, 40)}»`);
                    continue;
                }

                console.log(`    ${i + 1}. «${(doc.name || "(без названия)").slice(0, 48)}» -> ${candidate}`);
                renames.push({ collection, id: doc._id.toString(), from: group._id, to: candidate });
                planned++;

                if (APPLY) {
                    await db.collection(collection).updateOne(
                        { _id: doc._id },
                        { $set: { alias: candidate, updatedAt: new Date() } },
                    );
                    renamed++;
                }
            }
        }
    }

    // Кандидаты на упоминания держат alias текста для ссылки в админке — освежаем,
    // иначе ссылка ведёт в никуда.
    if (APPLY && renames.length) {
        for (const r of renames.filter((x) => x.collection === "texts")) {
            const { ObjectId } = await import("mongodb");
            await db.collection("mentionCandidates").updateMany(
                { textId: new ObjectId(r.id) },
                { $set: { textAlias: r.to } },
            );
        }
    }

    if (APPLY && renames.length) {
        await revalidateContent();
    }

    console.log(`\n=== Итого ===`);
    if (APPLY) {
        console.log(`Переименовано: ${renamed}`);
        console.log(`Старые адреса перестали открываться — карта сайта пересоберётся сама (revalidate).`);
    } else {
        console.log(`К переименованию: ${planned}. Ничего не изменено, для записи: --apply`);
    }
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

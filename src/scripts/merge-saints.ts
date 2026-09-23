// Сливает две записи каталога святых в одну: дубль снимается, всё, что на него
// ссылалось, переходит на оставляемую запись.
//
// ОТКУДА ДУБЛИ. Каталог собирается из нескольких источников — снимок dneslov,
// Собор новомучеников, память Минеи (import-memory-saints.ts), — и одно лицо
// бывает заведено дважды, когда источники пишут его по-разному: «Григо́рий
// Ни́сский» в святцах и «Григо́рий Нисси́йский» в Минее.
//
// ЧТО ОСТАЁТСЯ И ЧТО ПЕРЕНОСИТСЯ. Оставляемая запись сохраняет своё имя, адрес
// и внешние ключи. От снимаемой к ней переходят: внешние ключи и происхождение
// (provenance — памяти, из которых она заведена), её адрес — в previousSlugs
// (старая ссылка уводит редиректом), её URI — в previousUris (адрес лица,
// ушедший в чужую статью, остаётся разрешимым). Дни памяти объединяются у
// записей корпуса; у записей из снимка dneslov их пересобирает build-saints.ts.
//
// ССЫЛКИ НА СНИМАЕМУЮ ЗАПИСЬ переводятся везде, где святой хранится ключом:
// тексты (saintId, mentionSaintIds, mentions[].saintId), кандидаты упоминаний,
// словарь посвящений, очередь святых из Минеи, реестр святынь (typikon-users).
//
// Запуск:  npm run saints:merge -- --into <адрес|ключ> --from <адрес|ключ> [--write]
import "@/scripts/lib/env";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { saintIdOf } from "@/lib/saintKey";

const arg = (name: string) => {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 ? process.argv[i + 1] : undefined;
};
const WRITE = process.argv.includes("--write");

const main = async () => {
    const intoKey = await saintIdOf(arg("into"));
    const fromKey = await saintIdOf(arg("from"));
    if (!intoKey || !fromKey) { console.error("нужны --into и --from — адрес или ключ записи каталога"); process.exit(1); }
    if (intoKey === fromKey) { console.error("это одна и та же запись"); process.exit(1); }

    const client = await clientPromise;
    const db = client.db("typikon");
    const saints = db.collection("saints");
    const into = await saints.findOne({ _id: new ObjectId(intoKey) }) as any;
    const from = await saints.findOne({ _id: new ObjectId(fromKey) }) as any;
    console.log(`оставляем: ${into.name} (${into.slug}) ${into.uri ?? ""}`);
    console.log(`снимаем:   ${from.name} (${from.slug}) ${from.uri ?? ""}`);

    const ownDates = !(into.externals ?? []).length;
    const set: Record<string, unknown> = {
        externals: [...(into.externals ?? []), ...(from.externals ?? []).filter((e: any) =>
            !(into.externals ?? []).some((x: any) => x.source === e.source && String(x.id) === String(e.id)))],
        provenance: [...(into.provenance ?? []), ...(from.provenance ?? []).filter((p: any) =>
            !(into.provenance ?? []).some((x: any) => x.table === p.table && String(x.id) === String(p.id)))],
        previousSlugs: [...new Set([...(into.previousSlugs ?? []), ...(from.previousSlugs ?? []), from.slug].filter(Boolean))],
        previousUris: [...new Set([...(into.previousUris ?? []), ...(from.previousUris ?? []), from.uri].filter(Boolean))],
        ...(ownDates ? { memoryDates: [...new Set([...(into.memoryDates ?? []), ...(from.memoryDates ?? [])])] } : {}),
        updatedAt: new Date(),
    };

    // Сколько ссылок переедет — прежде записи.
    const texts = db.collection("texts");
    const counts = {
        "тексты (святой)": await texts.countDocuments({ saintId: fromKey }),
        "тексты (упоминания)": await texts.countDocuments({ mentionSaintIds: fromKey }),
        "кандидаты упоминаний": await db.collection("mentionCandidates").countDocuments({ saintId: fromKey }),
        "посвящения": await db.collection("dedications").countDocuments({ $or: [{ "saints.saintId": fromKey }, { "saintCandidates.saintId": fromKey }] }),
        "очередь святых": await db.collection("saint_proposals").countDocuments({ $or: [{ "duplicates.id": fromKey }, { mergedInto: fromKey }] }),
        "святыни": await client.db("typikon-users").collection("relics").countDocuments({ saintId: fromKey }),
    };
    for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);

    if (!WRITE) { console.log("холостой прогон — ничего не записано; --write запишет"); process.exit(0); }

    await texts.updateMany({ saintId: fromKey }, { $set: { saintId: intoKey } });
    await texts.updateMany({ mentionSaintIds: fromKey }, [{ $set: {
        mentionSaintIds: { $setUnion: [{ $filter: { input: "$mentionSaintIds", cond: { $ne: ["$$this", fromKey] } } }, [intoKey]] },
    } }]);
    await texts.updateMany({ "mentions.saintId": fromKey }, { $set: { "mentions.$[m].saintId": intoKey } },
        { arrayFilters: [{ "m.saintId": fromKey }] });
    await db.collection("mentionCandidates").updateMany({ saintId: fromKey }, { $set: { saintId: intoKey } });
    for (const field of ["saints", "saintCandidates"]) {
        await db.collection("dedications").updateMany({ [`${field}.saintId`]: fromKey },
            { $set: { [`${field}.$[s].saintId`]: intoKey, [`${field}.$[s].slug`]: into.slug, [`${field}.$[s].name`]: into.name } },
            { arrayFilters: [{ "s.saintId": fromKey }] });
    }
    await db.collection("saint_proposals").updateMany({ "duplicates.id": fromKey },
        { $pull: { duplicates: { id: fromKey } } } as any);
    await db.collection("saint_proposals").updateMany({ mergedInto: fromKey }, { $set: { mergedInto: intoKey } });
    const relics = client.db("typikon-users").collection("relics");
    await relics.updateMany({ saintId: fromKey }, { $set: { saintId: intoKey, saintName: into.name, saintSlug: into.slug } });

    // Происхождение уникально (одна память — одна запись): сперва снимаем его с
    // дубля, потом отдаём оставляемой, и только затем дубль удаляем.
    await saints.updateOne({ _id: from._id }, { $set: { provenance: [], externals: [] } });
    await saints.updateOne({ _id: into._id }, { $set: set });
    await saints.deleteOne({ _id: from._id });
    console.log("слито; сбросьте кэш святых и текстов (или дождитесь часа)");
    process.exit(0);
};

main().catch((e) => { console.error(e); process.exit(1); });

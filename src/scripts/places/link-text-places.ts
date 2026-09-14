// Места: упоминания в текстах корпуса (Пролог, Четьи-Минеи, отцы). Этап 4.
//
// Что делает (@/lib/places/textmatch): ищет в каждом тексте имена открытых мест и
// пишет упоминания в place_mentions (corpus: "text", method: "matcher"):
//   approved — рядом признак места («во граде», прилагательное) и имя не из тёзок;
//   pending  — имя с заглавной буквы без признака, на ревью в /admin/places/mentions.
//
// Разобранное на ревью не перезаписывается: у таких записей стоит reviewedAt, и
// повторный прогон их не трогает. Пересобираются только неразобранные найденные.
// Энциклопедия Никифора не просматривается: её статьи о местах связаны с местами
// ключом nikifor, и каждое имя в них было бы «упоминанием» самого себя.
//
// Запуск:  npm run places:link-texts                 # отчёт, ничего не пишет
//          npm run places:link-texts -- --write      # записать
//          npm run places:link-texts -- --sample 30  # больше примеров в отчёте
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { decide, findPlaceMentions, type Signal } from "@/lib/places/textmatch";
import { PLACE_MENTIONS } from "@/lib/places/schema";
import { loadPlaceIndex } from "@/scripts/places/lib/formIndex";

const WRITE = process.argv.includes("--write");
const SAMPLE = Number(process.argv[process.argv.indexOf("--sample") + 1]) || 12;
const LINKABLE = ["ready", "correcting", "texted"];

/** Языки книг, чья печать пишет собственные имена с большой буквы (@/utils/bookLanguages). */
const CAPITALIZING = new Set(["cu_gr", "ru"]);

async function main() {
    const db = (await clientPromise).db("typikon");

    const { index, places: placeById } = await loadPlaceIndex(db);

    const books = await db.collection("books").find({}, { projection: { language: 1, source: 1 } }).toArray();
    const capitalsOf = new Map(books.map((b) => [String(b._id), CAPITALIZING.has(b.language)]));
    const bean = books.find((b) => b.source === "wikisource:БЭАН");

    const texts = db.collection("texts").find(
        { readiness: { $in: LINKABLE }, content: { $gt: "" }, ...(bean ? { bookId: { $ne: bean._id } } : {}) },
        { projection: { name: 1, content: 1, bookId: 1 } },
    );

    const coll = db.collection(PLACE_MENTIONS);
    const reviewed = new Set((await coll.find({ corpus: "text", reviewedAt: { $exists: true } }, { projection: { placeId: 1, textId: 1 } }).toArray())
        .map((m) => `${m.placeId}|${m.textId}`));

    let scanned = 0;
    const docs: any[] = [];
    const bySignal: Record<Signal, number> = { "place-word": 0, adjective: 0, none: 0 };
    const byPlace = new Map<string, { approved: number; pending: number }>();
    const samples: { status: string; line: string }[] = [];

    for await (const text of texts) {
        scanned++;
        const capitals = capitalsOf.get(String(text.bookId)) ?? true;
        for (const hit of findPlaceMentions(text.content, index, capitals)) {
            if (reviewed.has(`${hit.placeId}|${text._id}`)) continue;
            const status = decide(hit);
            bySignal[hit.signal]++;
            const p = byPlace.get(hit.placeId) ?? { approved: 0, pending: 0 };
            p[status]++;
            byPlace.set(hit.placeId, p);
            docs.push({
                placeId: placeById.get(hit.placeId)!._id,
                corpus: "text", textId: text._id, canonRef: null, chantRef: null,
                word: hit.word, context: hit.context, signal: hit.signal, count: hit.count,
                method: "matcher", status,
            });
            samples.push({ status, line: `  ${placeById.get(hit.placeId)!.name} [${hit.signal}] «${hit.word}» — ${text.name?.slice(0, 40)}: «…${hit.context.slice(0, 160)}…»` });
        }
    }

    const approved = docs.filter((d) => d.status === "approved").length;
    console.log(`\n=== Отчёт ===`);
    console.log(`Текстов просмотрено: ${scanned}; мест в словаре: ${placeById.size}; уже разобрано на ревью пар: ${reviewed.size}`);
    console.log(`Упоминаний: ${docs.length}; принято само ${approved}, на ревью ${docs.length - approved}`);
    console.log(`По признаку: рядом «град/страна/…» ${bySignal["place-word"]}, прилагательное ${bySignal.adjective}, без признака ${bySignal.none}`);
    console.log(`Чаще всего (принято / на ревью):`);
    for (const [id, c] of [...byPlace].sort((a, b) => (b[1].approved + b[1].pending) - (a[1].approved + a[1].pending)).slice(0, 25)) {
        console.log(`  ${placeById.get(id)!.name}: ${c.approved} / ${c.pending}`);
    }
    const pick = (status: string) => {
        const list = samples.filter((s) => s.status === status);
        const step = Math.max(1, Math.floor(list.length / SAMPLE));
        return list.filter((_, i) => i % step === 0).slice(0, SAMPLE).map((s) => s.line).join("\n");
    };
    console.log(`Примеры принятого:\n${pick("approved")}`);
    console.log(`Примеры на ревью:\n${pick("pending")}`);

    if (!WRITE) {
        console.log(`Ничего не записано. Для записи: --write`);
        process.exit(0);
    }
    await coll.deleteMany({ corpus: "text", method: "matcher", reviewedAt: { $exists: false } });
    for (let i = 0; i < docs.length; i += 1000) await coll.insertMany(docs.slice(i, i + 1000));
    console.log(`Записано: ${docs.length}`);
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

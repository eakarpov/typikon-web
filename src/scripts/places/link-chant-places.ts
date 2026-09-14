// Места: упоминания в песнопениях корпуса typikon-rules (Октоих, Минеи, Триоди). Этап 5.
//
// Что делает: то же, что link-text-places (@/lib/places/textmatch), но по строкам
// content_items на церковнославянском гражданской печатью (language: cu_gr), и пишет
// упоминания в place_mentions (corpus: "chant", chantRef — item_id строки).
//
// ПОРОГ ИНОЙ, ЧЕМ ДЛЯ ПРОЗЫ. Песнопение пишет имя с заглавной и почти никогда не
// ставит рядом «град» или прилагательное: «от Вифлее́ма тщи́тся ко Иорда́ну». Если
// требовать признака, песнопения останутся без мест; если слать на ревью, разбирать
// придётся тысячи строк. Поэтому имя с заглавной (от пяти букв основы) принимается и
// без признака — на ревью идут только тёзки мест среди людей и колен (Иуда, Израиль).
// Выборка в отчёте нужна как раз затем, чтобы проверить этот порог глазами.
//
// Корпус пересобирается своим проектом, и item_id после пересборки может смениться:
// тогда прогон повторяют — упоминания этого метода пересобираются целиком, кроме
// разобранных на ревью.
//
// Запуск:  npm run places:link-chants                 # отчёт, ничего не пишет
//          npm run places:link-chants -- --write      # записать
import "@/scripts/lib/env";
import Database from "better-sqlite3";
import clientPromise from "@/lib/mongodb";
import { decide, findPlaceMentions } from "@/lib/places/textmatch";
import { PLACE_MENTIONS } from "@/lib/places/schema";
import { loadPlaceIndex } from "@/scripts/places/lib/formIndex";

const WRITE = process.argv.includes("--write");
const SAMPLE = Number(process.argv[process.argv.indexOf("--sample") + 1]) || 15;

async function main() {
    const file = process.env.RULES_DB;
    if (!file) throw new Error("Не задан RULES_DB — путь к корпусу typikon-rules");
    const rules = new Database(file, { readonly: true, fileMustExist: true });

    const db = (await clientPromise).db("typikon");
    const { index, places, personalKeys } = await loadPlaceIndex(db);
    let personal = 0;

    const coll = db.collection(PLACE_MENTIONS);
    const reviewed = new Set((await coll.find({ corpus: "chant", reviewedAt: { $exists: true } }, { projection: { placeId: 1, chantRef: 1 } }).toArray())
        .map((m) => `${m.placeId}|${m.chantRef}`));

    const rows = rules.prepare(
        `SELECT item_id, text FROM content_items WHERE language = 'cu_gr' AND text IS NOT NULL AND length(text) > 0`,
    ).iterate() as Iterable<{ item_id: number; text: string }>;

    let scanned = 0;
    const docs: any[] = [];
    const byPlace = new Map<string, number>();
    const samples: { status: string; line: string }[] = [];
    // Одна и та же строка печатается во многих изданиях и службах. Разбор текста один
    // раз на текст, а упоминание — на каждую строку: у каждой своя служба и своя ссылка.
    const cache = new Map<string, ReturnType<typeof findPlaceMentions>>();

    for (const row of rows) {
        scanned++;
        let hits = cache.get(row.text);
        if (!hits) {
            hits = findPlaceMentions(row.text, index, true);
            cache.set(row.text, hits);
        }
        for (const hit of hits) {
            const chantRef = String(row.item_id);
            if (reviewed.has(`${hit.placeId}|${chantRef}`)) continue;
            // Имя человека без признака места — обращение к святому, а не место:
            // «Анатолие», «Филиппе». Такое и на ревью не шлём: его тысячи.
            if (hit.signal === "none" && personalKeys.has(hit.formKey)) { personal++; continue; }
            // Заглавная в песнопении приравнена к признаку места; тёзки остаются на ревью.
            // Строчного без признака сюда не приходит: его отбрасывает сам поиск.
            const status = decide({ ...hit, signal: hit.signal === "none" ? "adjective" : hit.signal });
            byPlace.set(hit.placeId, (byPlace.get(hit.placeId) ?? 0) + 1);
            docs.push({
                placeId: places.get(hit.placeId)!._id,
                corpus: "chant", textId: null, canonRef: null, chantRef,
                word: hit.word, context: hit.context, signal: hit.signal, count: hit.count,
                method: "matcher", status,
            });
            if (samples.length < 20000) samples.push({ status, line: `  ${places.get(hit.placeId)!.name} [${hit.signal}] «${hit.word}»: «…${hit.context.slice(0, 150)}…»` });
        }
    }

    const approved = docs.filter((d) => d.status === "approved").length;
    console.log(`\n=== Отчёт ===`);
    console.log(`Строк песнопений: ${scanned}; разных текстов: ${cache.size}; мест в словаре: ${places.size}`);
    console.log(`Упоминаний: ${docs.length}; принято ${approved}, на ревью ${docs.length - approved}; мест: ${byPlace.size}`);
    console.log(`Отброшено как имя человека без признака места: ${personal}; таких форм: ${personalKeys.size} (${[...personalKeys].slice(0, 30).join(", ")})`);
    console.log(`Чаще всего: ${[...byPlace].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([id, n]) => `${places.get(id)!.name} ${n}`).join(", ")}`);
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
    await coll.deleteMany({ corpus: "chant", method: "matcher", reviewedAt: { $exists: false } });
    for (let i = 0; i < docs.length; i += 2000) await coll.insertMany(docs.slice(i, i + 2000));
    console.log(`Записано: ${docs.length}`);
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

// Места: упоминания в Писании. Этап 2 — после этапа 1 (стихи OpenBible лежат в
// openbible_verses, русские имена мест собраны).
//
// Что делает (@/lib/places/biblematch): каждый стих OpenBible переводит в стих
// Елизаветинской Библии, находя в славянском тексте имя места, и пишет упоминание
// в `place_mentions` (corpus: "bible", method: "openbible"):
//   approved — имя найдено в стихе канона;
//   pending  — не найдено (местоимение, «град сей», у места нет русского имени):
//              стих взят по выведенному сдвигу главы, решает ревью.
// Упоминания этого метода пересобираются целиком.
//
// Запуск:  npm run places:link-bible            # отчёт, ничего не пишет
//          npm run places:link-bible -- --write # записать
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { Anchor, candidateRefs, findForm, learnShifts, nameForms, NameForm } from "@/lib/places/biblematch";
import { OSIS_TO_CANON } from "@/lib/places/osis";
import { PLACE_MENTIONS, PLACES } from "@/lib/places/schema";

const WRITE = process.argv.includes("--write");

type Match = "exact" | "window" | "shift" | "chapter" | "none";

async function main() {
    const db = (await clientPromise).db("typikon");
    const edition = await db.collection("bible_editions").findOne({ code: "cs-eliz" });
    if (!edition) throw new Error("Нет издания cs-eliz");

    // Славянский текст целиком в память: 37 тысяч стихов, на каждый стих OpenBible — несколько поисков.
    const verses = new Map<string, { content: string; canonSort: number }>();
    const counts = new Map<string, Map<number, number>>(); // canonId → глава → стихов
    for await (const v of db.collection("bible_verses").find(
        { editionId: edition._id },
        { projection: { canonId: 1, canonChapter: 1, canonVerse: 1, canonRef: 1, canonSort: 1, content: 1 } },
    )) {
        verses.set(v.canonRef, { content: v.content, canonSort: v.canonSort });
        if (!counts.has(v.canonId)) counts.set(v.canonId, new Map());
        const m = counts.get(v.canonId)!;
        m.set(v.canonChapter, Math.max(m.get(v.canonChapter) ?? 0, v.canonVerse));
    }

    const places = await db.collection(PLACES).find(
        { "externals.source": "openbible" },
        { projection: { name: 1, names: 1 } },
    ).toArray();
    // Формы для поиска — надёжные имена: основное, библейские формы Никифора, от
    // редактора и метки Wikidata. Синонимы Wikidata в поиск не идут: у Египта среди
    // них «Фараон», у истории Ливана — «Кедр», и стих находился по чужому слову.
    const reliable = (n: any) => n.lang === "ru" && (n.source !== "wikidata" || n.role !== "variant");
    // Основное имя для отбора основных форм (@/lib/places/biblematch); у места с
    // латинским основным именем — первая библейская форма Никифора.
    const mainOf = (p: any) => /[а-яё]/i.test(p.name) ? p.name
        : (p.names ?? []).find((n: any) => n.source === "nikifor")?.name;
    const formsOf = new Map<string, NameForm[]>(places.map((p) => [String(p._id), nameForms([
        p.name, ...(p.names ?? []).filter(reliable).map((n: any) => n.name),
    ], mainOf(p))]));

    const obVerses = await db.collection("openbible_verses").find({}, { projection: { placeId: 1, osis: 1 } }).toArray();

    // Группировка по книге и главе источника: сдвиг выводится внутри главы.
    type Item = { placeId: string; osis: string; canonId: string; chapter: number; verse: number; found?: { ref: string; word: string; form: string; match: Match } };
    const items: Item[] = [];
    let unknownBook = 0;
    for (const v of obVerses) {
        const m = (v.osis as string).match(/^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)$/);
        const canonId = m && OSIS_TO_CANON[m[1]];
        if (!canonId) { unknownBook++; continue; }
        items.push({ placeId: String(v.placeId), osis: v.osis, canonId, chapter: Number(m![2]), verse: Number(m![3]) });
    }

    // Вне своего номера стиха — только основные формы имени.
    const tryRef = (item: Item, c: number, v: number, match: Match) => {
        const ref = `${item.canonId}.${c}.${v}`;
        const verse = verses.get(ref);
        const forms = formsOf.get(item.placeId) ?? [];
        if (!verse || !forms.length) return false;
        const hit = findForm(verse.content, forms, { primaryOnly: match !== "exact" });
        if (!hit) return false;
        item.found = { ref, word: hit.word, form: hit.form, match };
        return true;
    };

    // Проход 1: тот же стих и окрестности.
    for (const item of items) {
        const count = (c: number) => counts.get(item.canonId)?.get(c);
        for (const [c, v] of candidateRefs(item.canonId, item.chapter, item.verse, count)) {
            if (tryRef(item, c, v, c === item.chapter && v === item.verse ? "exact" : "window")) break;
        }
    }

    // Сдвиги глав по опорам первого прохода.
    const anchorsByBook = new Map<string, Anchor[]>();
    for (const item of items) {
        if (!item.found) continue;
        const [, c, v] = item.found.ref.split(".").map((x, i) => (i ? Number(x) : 0));
        if (!anchorsByBook.has(item.canonId)) anchorsByBook.set(item.canonId, []);
        anchorsByBook.get(item.canonId)!.push({ chapter: item.chapter, verse: item.verse, canonChapter: c, canonVerse: v });
    }
    const shiftsByBook = new Map([...anchorsByBook].map(([book, anchors]) => [book, learnShifts(anchors)]));

    // Проход 2: выведенный сдвиг главы.
    for (const item of items) {
        if (item.found) continue;
        const shift = shiftsByBook.get(item.canonId)?.get(item.chapter);
        if (!shift) continue;
        const c = item.chapter + shift.dc, v = item.verse + shift.dv;
        [0, 1, -1].some((d) => tryRef(item, c, v + d, "shift"));
    }

    // Упоминания: подтверждённые — по найденному стиху; прочие — по сдвигу или тому же номеру.
    const mentions = new Map<string, any>();
    const stats = new Map<string, Record<Match, number>>();
    let noForms = 0, noCanonVerse = 0;
    for (const item of items) {
        const shift = shiftsByBook.get(item.canonId)?.get(item.chapter);
        const ref = item.found?.ref ?? `${item.canonId}.${item.chapter + (shift?.dc ?? 0)}.${item.verse + (shift?.dv ?? 0)}`;
        const verse = verses.get(ref);
        const match: Match = item.found?.match ?? "none";
        const s = stats.get(item.canonId) ?? { exact: 0, window: 0, shift: 0, chapter: 0, none: 0 };
        s[match]++;
        stats.set(item.canonId, s);
        if (!item.found && !(formsOf.get(item.placeId) ?? []).length) noForms++;
        if (!verse) { noCanonVerse++; continue; }

        const key = `${item.placeId}|${ref}`;
        const prev = mentions.get(key);
        if (prev && prev.status === "approved") continue;
        mentions.set(key, {
            placeId: places.find((p) => String(p._id) === item.placeId)!._id,
            corpus: "bible",
            canonRef: ref,
            canonSort: verse.canonSort,
            osis: item.osis,
            match,
            ...(item.found ? { word: item.found.word } : {}),
            context: verse.content,
            method: "openbible",
            status: item.found ? "approved" : "pending",
        });
    }

    const total = { exact: 0, window: 0, shift: 0, chapter: 0, none: 0 };
    for (const s of stats.values()) for (const k of Object.keys(total) as Match[]) total[k] += s[k];
    const all = [...mentions.values()];

    console.log(`\n=== Отчёт ===`);
    console.log(`Стихов OpenBible: ${obVerses.length}; книга не сведена с каноном: ${unknownBook}`);
    console.log(`Найдено имя: тот же номер ${total.exact}, соседний стих ${total.window}, сдвиг главы ${total.shift}, по главе ${total.chapter}; не найдено ${total.none} (из них у места нет русского имени ${noForms})`);
    console.log(`Стиха канона нет (номер вне главы): ${noCanonVerse}`);
    console.log(`Упоминаний: ${all.length}; подтверждено ${all.filter((m) => m.status === "approved").length}, на ревью ${all.filter((m) => m.status === "pending").length}`);
    console.log(`По книгам, где сдвиги (книга: тот же / соседний / сдвиг / глава / нет):`);
    for (const [book, s] of [...stats].filter(([, s]) => s.window + s.shift + s.chapter > 5).sort((a, b) => (b[1].window + b[1].shift + b[1].chapter) - (a[1].window + a[1].shift + a[1].chapter)).slice(0, 15)) {
        console.log(`  ${book}: ${s.exact} / ${s.window} / ${s.shift} / ${s.chapter} / ${s.none}`);
    }
    const shifted = [...shiftsByBook].flatMap(([book, m]) => [...m].filter(([, s]) => s.dc || s.dv).map(([c, s]) => `${book} ${c}: ${s.dc >= 0 ? "+" : ""}${s.dc} гл., ${s.dv >= 0 ? "+" : ""}${s.dv} ст.`));
    console.log(`Выведенные сдвиги глав (${shifted.length}): ${shifted.slice(0, 25).join("; ")}`);

    // Примеры для глаза: равномерно по списку каждого способа.
    const nameOf = new Map(places.map((p) => [String(p._id), p.name as string]));
    const sample = (kind: Match, n: number, filter: (i: Item) => boolean = () => true) => {
        const list = items.filter((i) => (i.found?.match ?? "none") === kind && filter(i));
        const step = Math.max(1, Math.floor(list.length / n));
        return list.filter((_, i) => i % step === 0).slice(0, n)
            .map((i) => `  ${nameOf.get(i.placeId)}: ${i.osis} → ${i.found ? `${i.found.ref} «${i.found.word}» по форме «${i.found.form}»` : "—"}`);
    };
    console.log(`Примеры «соседний стих»:\n${sample("window", 8).join("\n")}`);
    console.log(`Примеры «сдвиг главы»:\n${sample("shift", 8).join("\n")}`);    console.log(`Примеры «не найдено» у мест с русским именем:\n${sample("none", 10, (i) => (formsOf.get(i.placeId) ?? []).length > 0).join("\n")}`);

    if (!WRITE) {
        console.log(`Ничего не записано. Для записи: --write`);
        process.exit(0);
    }
    const coll = db.collection(PLACE_MENTIONS);
    await coll.deleteMany({ corpus: "bible", method: "openbible" });
    for (let i = 0; i < all.length; i += 1000) await coll.insertMany(all.slice(i, i + 1000));
    console.log(`Записано упоминаний: ${all.length}`);
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

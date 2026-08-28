// Проставляет books.language.
//
// Смысл прогона — в том, что он делается СЕЙЧАС. Пока библиотека почти целиком
// на одном языке, ответ по каждой книге ещё можно получить; когда в ней
// появятся книги на других, отличить непроставленное от «просто не размечено»
// будет уже нечем, и разбирать придётся руками по сорока восьми книгам.
//
// ЯЗЫК ИЗМЕРЯЕТСЯ, А НЕ ПОДРАЗУМЕВАЕТСЯ. Первый заход ставил всем
// церковнославянский гражданским шрифтом («у нас же всё на цс») и немедленно
// соврал: «Пролог для чтения (ЦС шрифт)» набран уставным начертанием —
// «Мѣ́сѧца септе́мврїѧ», с титлами и ѣ. Таких книг восемь, и на глаз по
// названию они не видны: «Маргарит», «Лествица», «Беседы на Бытие» ничем в
// имени не выдают своей графики.
//
// Считаем долю церковнославянских букв (ѣ ѧ ѡ ꙋ ї ѵ ѳ ѕ ꙗ, титла и прочие
// надстрочные) среди всех кириллических. Замер по библиотеке разделяет книги
// начисто: уставные дают 12–23%, гражданские — 3.6% и ниже, между ними пусто.
// Порог посередине этого разрыва, и он не подгонка: 3.6% у «Синаксарей
// Постной Триоди» — это дореформенная ГРАЖДАНКА («Въ то́йже де́нь»), которой
// церковнославянский шрифт не нужен, а 12.4% у «Бесед на Бытие» — настоящее
// уставное начертание.
//
// Издания Библии не измеряем: у них уже стоит bibleLanguageCode, и он
// авторитетнее замера — это сведение об издании, а не догадка о наборе.
// Соответствие кодов держится в корпусе (typikon-rules/src/languages.py,
// BIBLE_CODE); здесь его обратная сторона, на два значения.
//
// Идемпотентен: книги с уже проставленным языком не трогает, если не --force.
// Запуск:  npm run db:book-languages  [-- --force]
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { BOOK_LANGUAGES, DEFAULT_BOOK_LANGUAGE } from "@/utils/bookLanguages";

const FROM_BIBLE_CODE: Record<string, string> = { cs: "cu", ro: "ro_cyr" };

// Буквы, которых в гражданской азбуке нет вовсе, и надстрочные знаки
// (U+0483–U+0489: титло, звательце, кендема). Перечень тот же, что в
// @/utils/churchSlavonic — там он служит нормализации, здесь распознаванию.
const CHURCH_CHARS = /[ѣꙋѹѧѩꙗѡѿѻіїѵєѕѳѫѯѱᲂ҃-҉]/g;
const CYRILLIC = /[Ѐ-ӿᲀ-᲏Ꙁ-ꚟ]/g;

const THRESHOLD = 0.08;   // посередине разрыва 3.6% … 12.4%
const SAMPLE_TEXTS = 8;   // книги большие; восьми текстов хватает с запасом
const SAMPLE_CHARS = 20000;

const main = async () => {
    const force = process.argv.includes("--force");
    const client = await clientPromise;
    const db = client.db("typikon");
    const books = db.collection("books");
    const texts = db.collection("texts");

    const known = new Set(BOOK_LANGUAGES.map(l => l.code));
    const all = await books.find({}, { projection: { name: 1, language: 1, bibleLanguageCode: 1 } })
        .sort({ name: 1 }).toArray();

    let set = 0, kept = 0;
    const empty: string[] = [];

    for (const b of all) {
        if (b.language && !force) {
            kept++;
            if (!known.has(b.language)) {
                console.warn(`  !! ${b.name} — язык "${b.language}" не из словаря @/utils/bookLanguages`);
            }
            continue;
        }

        let language: string;
        let note: string;

        if (FROM_BIBLE_CODE[b.bibleLanguageCode]) {
            language = FROM_BIBLE_CODE[b.bibleLanguageCode];
            note = `издание Библии, bibleLanguageCode=${b.bibleLanguageCode}`;
        } else {
            const sample = await texts
                .find({ bookId: b._id, content: { $type: "string", $ne: "" } }, { projection: { content: 1 } })
                .limit(SAMPLE_TEXTS).toArray();
            let church = 0, cyrillic = 0;
            for (const t of sample) {
                const c = (t.content as string).slice(0, SAMPLE_CHARS);
                church += (c.match(CHURCH_CHARS) || []).length;
                cyrillic += (c.match(CYRILLIC) || []).length;
            }
            if (!cyrillic) {
                // Книга-заготовка: текстов ещё нет, мерить нечего. Ставим
                // умолчание, но говорим об этом — проверить надо будет глазами.
                language = DEFAULT_BOOK_LANGUAGE;
                note = "текстов с содержимым нет — поставлено по умолчанию";
                empty.push(b.name);
            } else {
                const share = church / cyrillic;
                language = share >= THRESHOLD ? "cu" : DEFAULT_BOOK_LANGUAGE;
                note = `цс-букв ${(share * 100).toFixed(2)}% на ${sample.length} текстах`;
            }
        }

        await books.updateOne({ _id: b._id }, { $set: { language, updatedAt: new Date() } });
        console.log(`  ${language.padEnd(7)} ${b.name.slice(0, 52).padEnd(54)} ${note}`);
        set++;
    }

    console.log(`\nпроставлено: ${set}, оставлено как было: ${kept}, всего книг: ${all.length}`);
    if (empty.length) {
        console.log(`  ! мерить было нечего у ${empty.length}: ${empty.join(", ")}`);
    }
    const counts = new Map<string, number>();
    for (const b of await books.find({}, { projection: { language: 1 } }).toArray()) {
        const code = b.language || "(пусто)";
        counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    for (const [code, n] of [...counts].sort((a, b) => b[1] - a[1])) {
        console.log(`  ${code.padEnd(9)} ${n}`);
    }
    process.exit(0);
};

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

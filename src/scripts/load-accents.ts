// Собирает словарь ударений в typikon-csl.accents из трёх источников.
//
// Первый — корпус книг (Mongo, typikon): 183 тысячи основ живого употребления
// в прозаических чтениях, с частотами.
//
// Второй — корпус песнопений (SQLite проекта typikon-rules): Октоих, Минеи, Триоди,
// Часослов — 98 тысяч текстов и 2,1 миллиона размеченных словоформ, по весу почти как
// весь книжный корпус. Даёт 33 тысячи основ, которых нет больше нигде: гимнография
// держит свою лексику («богоневе́стная», «живоприе́мному», «уневе́стивый»).
//
// Третий — словарь церковнославянского (typikon-csl.lexems): 148 тысяч порождённых
// по парадигмам форм, тоже с ударениями. Поле lexems.search — это в точности наш
// accentKey, поэтому все три источника сходятся по одному ключу.
//
// Источники НЕ сливаются в одну «истину», и частоты у книг и песнопений считаются
// раздельно. Причина видна на омографах: «спасе» в чтениях это аорист «спасе́» (×50),
// а в песнопениях — звательный «спа́се» (×2024); «души» — «души́» (×545) против
// «ду́ши» (×3001). Жанр переворачивает большинство, и сложенная частота дала бы
// невнятную середину вместо двух внятных ответов.
//
// Со словарём расхождения ещё и другого рода: часть — законные омографы (зе́мли
// мн. им. и землѝ ед. род.), часть — ошибки порождения (у лексемы «твори́ти» форма
// «тво́рити», у «или́» — «и́ли»).
//
// Тот же прогон умеет выложить словарь файлом (--dump): файл собирается из тех же
// записей, что ложатся в коллекцию, поэтому выгрузка и API не разъезжаются.
//
// Запуск (локально нужен NODE_ENV=development: без него скрипт читает .env.production,
// где RULES_DB указывает на путь сервера, и песнопения молча выпадут из словаря):
//   NODE_ENV=development npm run accents:load
//   npm run accents:load -- --apply           # переписать коллекцию
//   npm run accents:load -- --apply --dump script-data/accents-full.json
import "@/scripts/lib/env";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import clientPromise from "@/lib/mongodb";
import { readChurchSlavonicCorpus } from "@/scripts/lib/corpus";
import {
    accentedVowel,
    accentKey,
    addContent,
    createDraft,
    finalize,
    findAccentIssues,
    hasAccent,
    isAbbreviated,
    syllables,
    WORD_PATTERN,
} from "@/lib/accents/core";
import {
    ACCENTS_COLLECTION,
    ACCENTS_DB,
    toStoredCorpus,
    toStoredLexicon,
    type AccentRecord,
    type CorpusVariant,
    type LexiconVariant,
} from "@/lib/accents/store";

const APPLY = process.argv.includes("--apply");
const dumpArg = process.argv.indexOf("--dump");
const DUMP = dumpArg > 0 ? process.argv[dumpArg + 1] : null;

const LEXEMS_DB = "typikon-csl";
const LEXEMS_COLLECTION = "lexems";

interface LexemForm {
    value?: string;
    properties?: string;
}

// Корпус песнопений живёт в чужом файле (см. src/lib/rulesDb.ts): его собирает
// проект typikon-rules, и на этой машине его может не быть вовсе. Это не повод
// падать — словарь просто соберётся из двух источников, о чём скрипт скажет вслух.
//
// Осторожно: build_db.py в typikon-rules удаляет файл и строит заново, и чтение
// посреди пересборки даёт неполный срез (проверено: тот же файл отдал 91 450
// текстов вместо 98 476, а следом — «database is locked»). Поэтому число
// прочитанных текстов печатается: если оно заметно меньше обычного, пересборка
// ещё идёт, и прогон надо повторить.
const readChants = (): { texts: string[]; broken: number } | null => {
    const file = process.env.RULES_DB;
    if (!file) {
        console.warn("  RULES_DB не задан — песнопения в словарь не войдут");
        return null;
    }

    // Ловим и открытие, и чтение: файл может быть занят (его держит запущенный
    // сайт или пересборка в typikon-rules), и это тоже не повод падать.
    let db;
    const texts: string[] = [];
    try {
        db = new Database(file, { readonly: true, fileMustExist: true });
        for (const table of ["content_items", "fixed_texts"]) {
            for (const row of db.prepare(`select text from ${table} where text is not null`).all() as { text: string }[]) {
                texts.push(row.text);
            }
        }
    } catch (e) {
        db?.close();
        console.warn(`  корпус песнопений недоступен (${file}): ${e instanceof Error ? e.message : e}`);
        console.warn(`  словарь соберётся без него — если это не задумано, остановите сайт и повторите`);
        return null;
    }

    // Заодно считаем сбитые знаки: чинить их отсюда нельзя (файл пересобирается
    // проектом typikon-rules), но знать их число полезно — в словарь они не идут.
    let broken = 0;
    for (const text of texts) {
        for (const word of text.match(WORD_PATTERN) ?? []) {
            if (isAbbreviated(word) || syllables(word) === 0 || !hasAccent(word)) continue;
            if (findAccentIssues(word).length) broken++;
        }
    }

    db.close();
    return { texts, broken };
};

async function main() {
    const client = await clientPromise;

    console.log("Читаю корпус…");
    const corpus = await readChurchSlavonicCorpus(client.db("typikon"));

    const draft = createDraft();
    for (const doc of corpus.docs) addContent(draft, doc.content);
    const dictionary = finalize(draft);
    console.log(`  основ из корпуса книг: ${dictionary.size}`);

    console.log("Читаю корпус песнопений…");
    const chantSource = readChants();
    const chantDraft = createDraft();
    if (chantSource) {
        for (const text of chantSource.texts) addContent(chantDraft, text);
    }
    const chantDictionary = finalize(chantDraft);
    if (chantSource) {
        console.log(`  текстов: ${chantSource.texts.length}, основ: ${chantDictionary.size}`);
        console.log(`  слов со сбитым знаком (в словарь не идут): ${chantSource.broken}`);
    }

    console.log("Читаю словарь церковнославянского…");
    const lexems = await client.db(LEXEMS_DB).collection(LEXEMS_COLLECTION)
        .find({}, { projection: { name: 1, forms: 1 } })
        .toArray();

    // Формы словаря сводим к тому же ключу и тому же положению ударения.
    const lexicon = new Map<string, Map<string, LexiconVariant>>();
    let formsSeen = 0;
    let formsPlain = 0;

    for (const lexeme of lexems) {
        for (const form of (lexeme.forms ?? []) as LexemForm[]) {
            const value = String(form.value ?? "");
            if (!value) continue;
            formsSeen++;

            if (!hasAccent(value)) { formsPlain++; continue; }

            const stress = accentedVowel(value.toLowerCase());
            if (!stress) continue;

            const key = accentKey(value);
            if (key.length < 2) continue;

            const variants = lexicon.get(key) ?? new Map<string, LexiconVariant>();
            const variantKey = `${stress.index}${stress.mark}`;
            const existing = variants.get(variantKey);

            if (existing) existing.forms++;
            else variants.set(variantKey, {
                vowel: stress.index,
                mark: stress.mark,
                spelling: value.toLowerCase(),
                lexeme: String(lexeme.name ?? ""),
                properties: String(form.properties ?? ""),
                forms: 1,
            });

            lexicon.set(key, variants);
        }
    }

    console.log(`  лексем: ${lexems.length}, форм: ${formsSeen} (без ударения ${formsPlain})`);
    console.log(`  основ из словаря: ${lexicon.size}`);

    // Сборка записей по объединению ключей всех трёх источников.
    const keys = new Set([...dictionary.keys(), ...chantDictionary.keys(), ...lexicon.keys()]);
    const records: AccentRecord[] = [];
    const stats = {
        fromCorpus: 0, fromChants: 0, fromLexicon: 0,
        compared: 0, agree: 0, disagree: 0,
    };

    const asCorpusVariants = (list: ReturnType<typeof finalize> extends Map<string, infer V> ? V : never): CorpusVariant[] =>
        list.map((variant) => ({
            vowel: variant.index,
            mark: variant.mark,
            spelling: variant.spelling,
            count: variant.count,
        }));

    for (const key of keys) {
        const corpusVariants = asCorpusVariants(dictionary.get(key) ?? []);
        const chantVariants = asCorpusVariants(chantDictionary.get(key) ?? []);
        const lexiconVariants: LexiconVariant[] = [...(lexicon.get(key)?.values() ?? [])]
            .sort((a, b) => b.forms - a.forms);

        if (corpusVariants.length) stats.fromCorpus++;
        if (chantVariants.length) stats.fromChants++;
        if (lexiconVariants.length) stats.fromLexicon++;

        // Сравниваем гласную, а не знак: оксия и вария на одном слоге — это одно
        // и то же ударение, вид знака зависит от места во фразе.
        const tops = [corpusVariants[0], chantVariants[0], lexiconVariants[0]]
            .filter(Boolean)
            .map((variant) => variant!.vowel);

        let agree: boolean | null = null;
        if (tops.length > 1) {
            stats.compared++;
            agree = tops.every((vowel) => vowel === tops[0]);
            if (agree) stats.agree++; else stats.disagree++;
        }

        // Пустые массивы не пишем вовсе: у большинства записей часть источников
        // молчит, и на четверти миллиона документов это заметная разница в объёме.
        records.push({
            _id: key,
            ...(corpusVariants.length ? { c: corpusVariants.map(toStoredCorpus) } : {}),
            ...(chantVariants.length ? { h: chantVariants.map(toStoredCorpus) } : {}),
            ...(lexiconVariants.length ? { x: lexiconVariants.map(toStoredLexicon) } : {}),
            a: agree,
        });
    }

    console.log(`\nВсего основ: ${records.length}`);
    console.log(`  знает корпус книг: ${stats.fromCorpus}`);
    console.log(`  знают песнопения: ${stats.fromChants}`);
    console.log(`  знает словарь: ${stats.fromLexicon}`);
    console.log(`  знают хотя бы двое: ${stats.compared} (согласны ${stats.agree}, расходятся ${stats.disagree})`);

    if (DUMP) {
        // Наружу — читаемые имена полей, а не короткие складские: файл читают люди
        // и чужие программы, экономить на именах там незачем.
        const payload = {
            meta: {
                about: "Словарь ударений церковнославянского языка (typikon.su). Ключ — слово "
                    + "без надстрочной разметки; corpus — употребление в книжных чтениях с "
                    + "частотами, chants — в гимнографии (Октоих, Минеи, Триоди, Часослов), "
                    + "lexicon — порождённые парадигмы словаря с грамматикой. Частоты у книг и "
                    + "песнопений раздельные: жанр переворачивает большинство на омографах.",
                caveat: "Словарь описательный, а не нормативный: он говорит, как слово размечено "
                    + "в этом собрании и сколько раз, а не как правильно.",
                words: records.length,
                sources: stats,
                license: "Корпус — CC BY 4.0, см. LICENSE-CORPUS.md",
            },
            words: Object.fromEntries(records
                .slice()
                .sort((a, b) => a._id.localeCompare(b._id, "ru"))
                .map((record) => [record._id, {
                    corpus: (record.c ?? []).map((v) => ({ vowel: v.v, mark: v.m, spelling: v.s, count: v.n })),
                    chants: (record.h ?? []).map((v) => ({ vowel: v.v, mark: v.m, spelling: v.s, count: v.n })),
                    lexicon: (record.x ?? []).map((v) => ({ vowel: v.v, mark: v.m, spelling: v.s, lexeme: v.l, properties: v.p, forms: v.n })),
                    agree: record.a,
                }])),
        };

        mkdirSync(dirname(DUMP), { recursive: true });
        const json = JSON.stringify(payload);
        writeFileSync(DUMP, json, "utf8");
        console.log(`\nВыгрузка: ${DUMP}, ${(Buffer.byteLength(json, "utf8") / 1e6).toFixed(1)} МБ`);
    }

    if (!APPLY) {
        console.log(`\nЭто предварительный прогон, база не тронута. Повторите с --apply.`);
        process.exit(0);
    }

    const accents = client.db(ACCENTS_DB).collection<AccentRecord>(ACCENTS_COLLECTION);

    // Коллекция производная и пересобирается целиком: доливать в неё нельзя, иначе
    // основы, исчезнувшие из корпуса после правки, останутся навсегда.
    console.log(`\nПерезаписываю ${ACCENTS_DB}.${ACCENTS_COLLECTION}…`);
    await accents.deleteMany({});

    const BATCH = 5000;
    for (let i = 0; i < records.length; i += BATCH) {
        await accents.insertMany(records.slice(i, i + BATCH), { ordered: false });
    }

    // Поиск идёт по _id, отдельного индекса не нужно.
    const written = await accents.countDocuments({});
    console.log(`Записано: ${written}`);

    process.exit(0);
}

main();

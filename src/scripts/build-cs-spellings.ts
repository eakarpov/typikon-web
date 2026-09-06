import "@/scripts/lib/env";
import { MongoClient } from "mongodb";
import fs from "node:fs";
import path from "node:path";
import { civilKey, csCanonical, byRule, matchCase, DOMINANCE } from "@/lib/cslav/core";
import { WORD_PATTERN, findAccentIssues } from "@/lib/accents/core";
import { expandTitlo } from "@/lib/cslav/titla";
import { csNumeral } from "@/lib/csEncoding/numerals";

// Указатель «гражданское написание → церковнославянское».
//
// ЗАЧЕМ. Свёртка написаний необратима по построению (е из {е, ѣ, є}, о из
// {о, ѡ, ѻ}), и обратный ход возможен только по засвидетельствованному: что
// стоит в книгах, то и предлагаем. Указатель — свод показаний, а не норма.
//
// ТРИ ИСТОЧНИКА ХРАНЯТСЯ РАЗДЕЛЬНО и не складываются в одно число:
//   c — собрание (322 текста ЦС-графики): живое употребление с частотами;
//   x — словарь typikon-csl.lexems: нормативные формы с грамматическими
//       пометами, но без частот;
//   b — Елизаветинская Библия: ДРУГОЙ ИЗВОД (уставное cu против гражданского
//       cu_gr наших книг), и сложенная с собранием частота дала бы невнятную
//       середину.
//
// ЧТО МОЖНО РАЗДАВАТЬ. Прецедент — слой ударений в выгрузке: там отдаётся
// только выведенное из нашего корпуса, а чужой словарь исключён явно. Здесь то
// же: наружу пойдёт часть `c`, а `x` и `b` выведены из чужих оцифровок
// (см. LICENSE-CORPUS.md: `cs-eliz` — «чужая оцифровка», в выгрузке «нет»).

const CORPUS_DB = "typikon";
const DICT_DB = "typikon-csl";
const SPELLINGS = "spellings";

interface CorpusVariant { w: string; n: number; d: number }
interface DictVariant { w: string; l: string; p: string }
interface BibleVariant { w: string; n: number }

// Написание — это БУКВЫ, а не буквы с ударением. Ударения у нас решает свой
// словарь (typikon-csl.accents), и мешать два вопроса в один нельзя: первый
// прогон показал, что тогда «и҆́же» и «и҆̀же» встают спорной парой, хотя буквы в
// них одни и те же, и спорных ключей выходит 6 222 вместо настоящих.
//
// Поэтому вариант опознаётся по буквам, а показывается тем начертанием с
// ударением, которое в собрании чаще: читателю нужен готовый облик слова.
const lettersOnly = (word: string) =>
    word.normalize("NFD").replace(/[\u0300-\u036f\u0483-\u0489]/g, "").normalize("NFC");

interface Entry {
    c: Map<string, { n: number; texts: Set<string>; forms: Map<string, number> }>;
    x: DictVariant[];
    b: Map<string, number>;
    t: Map<string, number>;
}

const entry = (): Entry => ({ c: new Map(), x: [], b: new Map(), t: new Map() });

const argv = process.argv.slice(2);
const has = (flag: string) => argv.includes(flag);
const value = (flag: string) => {
    const at = argv.indexOf(flag);
    return at >= 0 ? argv[at + 1] : undefined;
};

/**
 * Слова строки.
 *
 * Однобуквенные не отсеиваются: в церковнославянском это полноценные слова —
 * «ѿ», «ѡ», «и҆», «а҆», «ꙗ҆». Отсев по длине стоил указателю именно их, и «от»
 * уходило правилу, дававшему «о҆т» вместо «ѿ».
 */
const wordsOf = (text: string): string[] => text.match(WORD_PATTERN) ?? [];

// Слово под титлом или с выносной — не написание слова, а его замена, и в один
// ряд с написаниями оно не встаёт: «гдⷭ҇ь» не вариант «господь», а сокращение.
const isShortened = (word: string) => /[҃҇ⷠ-ⷿ]/.test(word);

// Блуждающий ведущий надстрочный знак — дефект набора: 3 793 слова собрания
// начинаются со знака, повисшего без буквы. Снимаем при сборке, считаем в отчёте.
const LEADING_MARK = /^[̀-ͯ҃-҉ⷠ-ⷿ]+/;

const main = async () => {
    const client = new MongoClient(process.env.MONGODB_URI!);
    await client.connect();

    const index = new Map<string, Entry>();
    const take = (key: string) => {
        const found = index.get(key);
        if (found) return found;
        const fresh = entry();
        index.set(key, fresh);
        return fresh;
    };

    const stats = {
        corpusTexts: 0, corpusTokens: 0, dictForms: 0, bibleTokens: 0,
        leadingMark: 0, shortened: 0, dropped: 0, defective: 0, dictDuplicates: 0,
        titloLinked: 0, titloUnknown: 0, numerals: 0,
    };

    // Отложенная десятая часть: без неё проверка мерит, как собрание
    // воспроизводит само себя. Берём по остатку от деления, чтобы состав
    // отложенного не менялся от прогона к прогону.
    const holdout = new Set<string>();

    // --- 1. Собрание ---------------------------------------------------------
    const texts = await client.db(CORPUS_DB).collection("texts")
        .find({ csSource: true }, { projection: { alias: 1, content: 1 } }).toArray() as any[];
    texts.forEach((doc, i) => { if (i % 10 === 0) holdout.add(String(doc.alias)); });

    for (const doc of texts) {
        const alias = String(doc.alias);
        if (has("--check") && holdout.has(alias)) continue;
        stats.corpusTexts++;
        for (const raw of wordsOf(String(doc.content ?? ""))) {
            let word = raw;
            if (LEADING_MARK.test(word)) { stats.leadingMark++; word = word.replace(LEADING_MARK, ""); }
            const spelling = csCanonical(word.toLowerCase());
            const key = civilKey(spelling);
            if (!key || /[^а-яё]/.test(key)) { stats.dropped++; continue; }
            stats.corpusTokens++;

            if (isShortened(spelling)) {
                stats.shortened++;
                // Сокращение кладём под ключ ПОЛНОГО слова, а не своего костяка:
                // спрашивают у указателя «господи», а показать надо «гдⷭ҇и».
                // Костяк раскрывается таблицей титл, перенесённой из корпуса.
                // Порядок проверок существен. Под титлом стоит и сокращение, и
                // число («кз҃» — это 27), а по буквам они неразличимы: костяк
                // «гди» читается цифирью как 15. Поэтому сперва спрашиваем
                // выверенную таблицу сокращений, и только то, чего она не знает,
                // пробуем прочесть числом. Обратный порядок стоил 13 тысяч
                // связок: цифирь разобрала «бг҃ъ» как 5.
                const expanded = expandTitlo(key);
                if (!expanded) {
                    if (csNumeral(spelling, { thousands: true, sign: "titlo" }) !== null) stats.numerals++;
                    else stats.titloUnknown++;
                    continue;
                }
                const full = civilKey(expanded);
                const at = take(full);
                at.t.set(spelling, (at.t.get(spelling) ?? 0) + 1);
                stats.titloLinked++;
                continue;
            }
            const place = take(key);
            // Дефекты набора в указатель не пускаем: двойная вария, ударение
            // не над гласной и прочее, что находит findAccentIssues.
            if (findAccentIssues(spelling).length) { stats.defective++; continue; }

            const letters = lettersOnly(spelling);
            const seen = place.c.get(letters)
                ?? { n: 0, texts: new Set<string>(), forms: new Map<string, number>() };
            seen.n += 1;
            seen.texts.add(alias);
            seen.forms.set(spelling, (seen.forms.get(spelling) ?? 0) + 1);
            place.c.set(letters, seen);
        }
    }

    // --- 2. Словарь ----------------------------------------------------------
    const lexems = await client.db(DICT_DB).collection("lexems")
        .find({}, { projection: { name: 1, properties: 1, forms: 1 } }).toArray() as any[];
    for (const lexeme of lexems) {
        for (const form of lexeme.forms ?? []) {
            const raw = String(form.value ?? "").trim();
            if (!raw) continue;
            const spelling = csCanonical(raw);
            const key = civilKey(spelling);
            if (!key || /[^а-яё]/.test(key)) continue;
            stats.dictForms++;
            const place = take(key);
            const candidate: DictVariant = {
                w: spelling,
                l: String(lexeme.name ?? ""),
                p: String(form.properties ?? ""),
            };
            // В словаре у одной лексемы формы нередко лежат дважды: с ударением
            // и без («госпо́ди» и «господи»). Безударный дубль читателю
            // предлагать нечего, и в указателе он только весит.
            const twin = place.x.findIndex((v) =>
                v.l === candidate.l && v.p === candidate.p
                && lettersOnly(v.w) === lettersOnly(candidate.w));
            if (twin >= 0) {
                const kept = place.x[twin];
                const keptMarks = kept.w.length - lettersOnly(kept.w).length;
                const freshMarks = candidate.w.length - lettersOnly(candidate.w).length;
                if (freshMarks > keptMarks) place.x[twin] = candidate;
                stats.dictDuplicates++;
                continue;
            }
            place.x.push(candidate);
        }
    }

    // --- 3. Библия -----------------------------------------------------------
    const biblePath = value("--bible")
        ?? path.join(process.cwd(), "..", "typikon-rules", "raw", "bible-cs.json");
    if (fs.existsSync(biblePath)) {
        const bible = JSON.parse(fs.readFileSync(biblePath, "utf8"));
        const verses: any[] = Array.isArray(bible) ? bible : (bible.verses ?? []);
        for (const verse of verses) {
            for (const raw of wordsOf(String(verse.text ?? verse.content ?? ""))) {
                const word = raw.replace(LEADING_MARK, "");
                const spelling = csCanonical(word.toLowerCase());
                const key = civilKey(spelling);
                if (!key || /[^а-яё]/.test(key) || isShortened(spelling)) continue;
                stats.bibleTokens++;
                const place = take(key);
                place.b.set(spelling, (place.b.get(spelling) ?? 0) + 1);
            }
        }
    } else {
        console.log(`Библия не найдена (${biblePath}) — третий источник пропущен.`);
    }

    // --- Разрешение спора ----------------------------------------------------
    interface Ranked { spelling: string; letters: string; n: number; d: number }
    const ranked = (place: Entry): Ranked[] =>
        [...place.c.entries()]
            .map(([letters, seen]) => ({
                letters,
                // Начертание с ударением — самое частое в группе.
                spelling: [...seen.forms.entries()].sort((a, b) => b[1] - a[1])[0][0],
                n: seen.n,
                d: seen.texts.size,
            }))
            .sort((a, b) => b.n - a.n || b.d - a.d);

    const settled = (place: Entry): { best: Ranked | null; disputed: boolean } => {
        const list = ranked(place);
        if (!list.length) return { best: null, disputed: false };
        if (list.length === 1) return { best: list[0], disputed: false };
        const [best, rival] = list;

        // Словарь подтверждает лидера — но ТОЛЬКО если сам предлагает одно
        // написание. Если у него их несколько, это разные формы одного слова
        // («тебѣ» дательный против «тебе» винительного), и подтверждать лидера
        // чужим падежом значит глушить ровно тот спор, ради которого указатель
        // и строится. Первый прогон так и вышло: спорных осталось 0,5%
        // словоупотреблений, потому что словарь заглушал «себе/себѣ».
        const dictForms = new Set(place.x.map((v) => lettersOnly(v.w)));
        if (dictForms.size === 1 && dictForms.has(best.letters)) return { best, disputed: false };

        const strong = best.n >= DOMINANCE * rival.n && best.d >= DOMINANCE * rival.d;
        return { best, disputed: !strong };
    };

    let disputed = 0;
    let disputedTokens = 0;
    let corpusKeys = 0;
    let allTokens = 0;
    const examples: Array<[string, Ranked[]]> = [];
    for (const [key, place] of index) {
        if (!place.c.size) continue;
        corpusKeys++;
        const list = ranked(place);
        const tokens = list.reduce((sum, v) => sum + v.n, 0);
        allTokens += tokens;
        if (settled(place).disputed) {
            disputed++;
            disputedTokens += tokens;
            if (examples.length < 10 && tokens > 200) examples.push([key, list.slice(0, 3)]);
        }
    }

    console.log("\n=== Источники ===");
    console.log(`собрание: ${stats.corpusTexts} текстов, ${stats.corpusTokens.toLocaleString("ru")} словоупотреблений`
        + (has("--check") ? ` (отложено ${holdout.size} текстов)` : ""));
    console.log(`словарь: ${lexems.length.toLocaleString("ru")} лексем, ${stats.dictForms.toLocaleString("ru")} форм`
        + ` (безударных дублей свёрнуто: ${stats.dictDuplicates.toLocaleString("ru")})`);
    console.log(`Библия: ${stats.bibleTokens.toLocaleString("ru")} словоупотреблений`);
    console.log(`ключей в указателе: ${index.size.toLocaleString("ru")} (из собрания ${corpusKeys.toLocaleString("ru")})`);
    console.log(`сокращений под титлом и с выносными: ${stats.shortened.toLocaleString("ru")}`
        + ` (связано с полным словом ${stats.titloLinked.toLocaleString("ru")},`
        + ` цифирь ${stats.numerals.toLocaleString("ru")},`
        + ` костяк не раскрылся у ${stats.titloUnknown.toLocaleString("ru")})`);
    console.log(`слов с блуждающим ведущим знаком: ${stats.leadingMark.toLocaleString("ru")}`);
    console.log(`отброшено как не слово: ${stats.dropped.toLocaleString("ru")}`);
    console.log(`отброшено с дефектом набора: ${stats.defective.toLocaleString("ru")}`);

    console.log("\n=== Спор ===");
    console.log(`спорных ключей: ${disputed.toLocaleString("ru")} из ${corpusKeys.toLocaleString("ru")}`
        + ` (${(disputed / corpusKeys * 100).toFixed(1)}%)`);
    console.log(`словоупотреблений в них: ${disputedTokens.toLocaleString("ru")} из ${allTokens.toLocaleString("ru")}`
        + ` (${(disputedTokens / allTokens * 100).toFixed(1)}%)`);
    for (const [key, list] of examples) {
        console.log(`   ${key} → ${list.map((v) => `${v.spelling} ×${v.n}/${v.d}т`).join(", ")}`);
    }

    // --- Проверка на отложенном ---------------------------------------------
    if (has("--check")) {
        const held = texts.filter((d) => holdout.has(String(d.alias)));
        let total = 0, dict = 0, rule = 0, ruleExact = 0, untouched = 0, dictExact = 0;
        for (const doc of held) {
            for (const raw of wordsOf(String(doc.content ?? ""))) {
                const word = raw.replace(LEADING_MARK, "");
                if (isShortened(word)) continue;
                const expected = csCanonical(word.toLowerCase());
                const key = civilKey(expected);
                if (!key || /[^а-яё]/.test(key)) continue;
                // Гражданский облик — то, что набрал бы человек.
                const civil = key;
                total++;

                const place = index.get(key);
                const answer = place && place.c.size ? settled(place).best : null;
                // Сверяем буквы: ударение — вопрос своего словаря, и мешать
                // два вопроса в одну оценку значит мерить не то.
                const want = lettersOnly(expected);
                if (answer) {
                    dict++;
                    if (answer.letters === want) dictExact++;
                } else if (place?.x.length) {
                    dict++;
                    if (lettersOnly(place.x[0].w) === want) dictExact++;
                } else {
                    rule++;
                    const got = matchCase(civil, byRule(civil).form);
                    if (lettersOnly(csCanonical(got.toLowerCase())) === want) ruleExact++;
                    else untouched++;
                }
            }
        }
        console.log("\n=== Проверка на отложенной десятой части ===");
        console.log(`текстов: ${held.length}, словоупотреблений: ${total.toLocaleString("ru")}`);
        console.log(`по словарю: ${dict.toLocaleString("ru")} (${(dict / total * 100).toFixed(1)}%), `
            + `из них точно: ${dictExact.toLocaleString("ru")} (${(dictExact / dict * 100).toFixed(1)}%)`);
        console.log(`по правилу: ${rule.toLocaleString("ru")} (${(rule / total * 100).toFixed(1)}%), `
            + `из них точно: ${ruleExact.toLocaleString("ru")} (${(ruleExact / Math.max(rule, 1) * 100).toFixed(1)}%)`);
        console.log(`всего точно воспроизведено: ${((dictExact + ruleExact) / total * 100).toFixed(1)}%`);
        console.log("Оценка верхняя: свёрнутый церковнославянский текст ложится на указатель лучше,");
        console.log("чем текст, набранный человеком с нуля.");
    }

    // --- Запись --------------------------------------------------------------
    if (has("--apply")) {
        const collection = client.db(DICT_DB).collection(SPELLINGS);
        const documents = [...index.entries()].map(([key, place]) => ({
            _id: key as any,
            ...(place.c.size ? {
                c: ranked(place).map((v): CorpusVariant => ({ w: v.spelling, n: v.n, d: v.d })),
            } : {}),
            ...(place.x.length ? { x: place.x } : {}),
            ...(place.b.size ? {
                b: [...place.b.entries()].sort((a, b) => b[1] - a[1])
                    .map(([w, n]): BibleVariant => ({ w, n })),
            } : {}),
            ...(place.t.size ? {
                t: [...place.t.entries()].sort((a, b) => b[1] - a[1]).map(([w, n]) => ({ w, n })),
            } : {}),
            // Согласие считается ПО БУКВАМ. Словарь не несёт ни звательц (их в
            // формах нет вовсе), ни того же ударения, что собрание, и сравнение
            // написаний целиком давало ложное расхождение: «ᲂу҆слы́ши» собрания
            // против «ᲂуслы́ши» словаря — одно и то же слово.
            a: place.c.size && place.x.length
                ? place.x.some((v) => lettersOnly(v.w) === ranked(place)[0].letters)
                : null,
        }));
        // Перезапись целиком, а не долив: исчезнувшие из корпуса написания
        // иначе остались бы в указателе навсегда.
        await collection.deleteMany({});
        for (let at = 0; at < documents.length; at += 5000) {
            await collection.insertMany(documents.slice(at, at + 5000) as any[]);
        }
        console.log(`\nзаписано в ${DICT_DB}.${SPELLINGS}: ${documents.length.toLocaleString("ru")} ключей`);
    } else {
        console.log("\nПрогон без записи. Чтобы записать указатель, добавьте --apply.");
    }

    await client.close();
};

if (process.argv[1]?.endsWith("build-cs-spellings.ts")) {
    main().catch((e) => { console.error(e); process.exit(1); });
}

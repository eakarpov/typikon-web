import "@/scripts/lib/env";
import { MongoClient } from "mongodb";
import fs from "node:fs";
import path from "node:path";
import { civilKey, csCanonical, byRule, matchCase, DOMINANCE } from "@/lib/cslav/core";
import { WORD_PATTERN, findAccentIssues } from "@/lib/accents/core";
import {
    expandTitlo, expandAnywhere, expandSkeleton, fitsContraction, fitsSkeleton, hasSacredStem, hasSuperscript,
    titloEra, titloSkeleton,
} from "@/lib/cslav/titla";
import { csNumeral } from "@/lib/csEncoding/numerals";
import { convertWithAnswers, type CslAnswer } from "@/lib/cslav/convert";
import { contextKeys, defaultOf, GROUPS, type LetterTable } from "@/lib/cslav/positional";

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
// s — часть речи ЛЕКСЕМЫ (ADV, A, S, V), а не помета формы. Она нужна там, где
// написание различает не падеж, а часть речи: наречие на -о пишется омегой
// («вѣ́рнѡ»), краткое прилагательное — обычным о («вѣ́рно»). У формы наречия
// помет нет вовсе, и без этого поля спор выходил безымянным.
interface DictVariant { w: string; l: string; p: string; s?: string }
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

type Attested = Map<string, { n: number; texts: Set<string>; forms: Map<string, number> }>;

interface Entry {
    c: Attested;
    /**
     * Минея церковнославянским шрифтом — четвёртый источник, отдельно от «c».
     *
     * Извод тот же, что у собрания (синодальный), но оцифровка ЧУЖАЯ (azbyka),
     * и в выгрузку она пойти не может; собрание же выкладывается. Поэтому поле
     * своё. Оно же и главное свидетельство служебной титлы: книги нашего
     * собрания аскетические, и «бцⷣа», «прест҃а́ѧ», «пребл҃же́нне» встречаются
     * только здесь.
     */
    m: Attested;
    x: DictVariant[];
    b: Map<string, number>;
    /** Сокращения: написание → сколько раз и какого извода. */
    t: Map<string, { n: number; old: boolean }>;
}

const entry = (): Entry => ({ c: new Map(), m: new Map(), x: [], b: new Map(), t: new Map() });

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

    /** Сокращение под ключ полного слова. */
    const link = (full: string, spelling: string, old: boolean, times = 1) => {
        const at = take(full);
        const seen = at.t.get(spelling) ?? { n: 0, old };
        seen.n += times;
        // Извод решается написанием, а не книгой: одно и то же сокращение в
        // старопечатной книге и в синодальной — одно и то же сокращение.
        seen.old = seen.old && old;
        at.t.set(spelling, seen);
    };

    const stats = {
        corpusTexts: 0, corpusTokens: 0, dictForms: 0, bibleTokens: 0,
        leadingMark: 0, shortened: 0, dropped: 0, defective: 0, dictDuplicates: 0,
        titloLinked: 0, titloUnknown: 0, numerals: 0,
        titloByStem: 0, titloByTable: 0, titloByWord: 0, titloByOrder: 0,
        titloByContraction: 0, titloRejected: 0, titloOld: 0, titloSynodal: 0,
        menaionDays: 0, menaionTokens: 0, menaionShortened: 0, titloByPrefix: 0,
    };

    // Отложенная десятая часть: без неё проверка мерит, как собрание
    // воспроизводит само себя. Берём по остатку от деления, чтобы состав
    // отложенного не менялся от прогона к прогону.
    const holdout = new Set<string>();

    // Сокращения и полные слова собираются в одном проходе, а связываются во
    // втором: чтобы сверить костяк с полным словом, надо сперва дочитать все
    // полные слова.
    const pending: string[] = [];
    const fullKeys = new Set<string>();

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
                // Сокращение кладём под ключ ПОЛНОГО слова, а не своего костяка:
                // спрашивают у указателя «господи», а показать надо «гдⷭ҇и».
                // Раскрытие отложено до конца прохода: часть костяков сверяется
                // с полными словами собрания, а их список к этой минуте ещё не
                // собран (см. resolveShortened).
                stats.shortened++;
                pending.push(spelling);
                continue;
            }
            fullKeys.add(key);
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
                ...(lexeme.properties ? { s: String(lexeme.properties) } : {}),
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

    const bibleShort: string[] = [];

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
                if (!key || /[^а-яё]/.test(key)) continue;
                // Сокращения Библии — лучшее свидетельство синодального извода:
                // это печать синодальной эпохи, и что сокращено там, то
                // сокращается и у нас. Их 13 542 при 474 видах, и все до одного
                // суть сокращения священных слов.
                if (isShortened(spelling)) { bibleShort.push(spelling); continue; }
                stats.bibleTokens++;
                const place = take(key);
                place.b.set(spelling, (place.b.get(spelling) ?? 0) + 1);
            }
        }
    } else {
        console.log(`Библия не найдена (${biblePath}) — третий источник пропущен.`);
    }

    // --- 3а. Минея церковнославянским шрифтом --------------------------------
    //
    // Пара к гражданской Минее, которую разбирает корпус (raw/menaion): azbyka
    // выкладывает одно издание дважды, страница на день. Сверка сентября
    // показала 93,2% совпадения по свёртке, а остаток объясним — цифирь, где
    // гражданское издание пишет числа цифрами; расхождения ы/и и ѧ/я между
    // изданиями; и сокращения, которых у нас нечем раскрыть. Последние и есть
    // то, ради чего книга берётся.
    const menaionShort: string[] = [];
    // Отложенные дни Минеи: на них идёт обратная проверка — гражданское
    // издание прогоняется переводчиком и сверяется с церковнославянским. Если
    // день оставить в указателе, проверка померит, как он воспроизводит сам
    // себя. Берём каждый десятый по порядку, чтобы состав не плавал.
    const menaionHoldout: Array<{ month: string; day: string }> = [];
    const menaionRoot = value("--menaion")
        ?? path.join(process.cwd(), "..", "typikon-rules", "raw", "menaion-cu");
    if (fs.existsSync(menaionRoot)) {
        for (const month of fs.readdirSync(menaionRoot).sort()) {
            const days = path.join(menaionRoot, month, "text");
            if (!fs.existsSync(days)) continue;
            for (const file of fs.readdirSync(days).sort()) {
                const alias = `${month}/${file.replace(/\.txt$/, "")}`;
                if (has("--check") && stats.menaionDays % 10 === 0) {
                    menaionHoldout.push({ month, day: file.replace(/\.txt$/, "") });
                    stats.menaionDays++;
                    continue;
                }
                const raw = fs.readFileSync(path.join(days, file), "utf8");
                // Заголовок обхода (URL, TITLE) отрезается: это не книга.
                const body = raw.split("-".repeat(40)).slice(1).join("-".repeat(40));
                stats.menaionDays++;
                for (const token of wordsOf(body)) {
                    const word = token.replace(LEADING_MARK, "");
                    const spelling = csCanonical(word.toLowerCase());
                    const key = civilKey(spelling);
                    if (!key || /[^а-яё]/.test(key)) continue;
                    if (isShortened(spelling)) { stats.menaionShortened++; menaionShort.push(spelling); continue; }
                    if (findAccentIssues(spelling).length) continue;
                    stats.menaionTokens++;
                    const place = take(key);
                    const letters = lettersOnly(spelling);
                    const seen = place.m.get(letters)
                        ?? { n: 0, texts: new Set<string>(), forms: new Map<string, number>() };
                    seen.n += 1;
                    seen.texts.add(alias);
                    seen.forms.set(spelling, (seen.forms.get(spelling) ?? 0) + 1);
                    place.m.set(letters, seen);
                }
            }
        }
        console.log(`Минея ЦС: ${stats.menaionDays} дней, ${stats.menaionTokens.toLocaleString("ru")}`
            + ` словоупотреблений, сокращений ${stats.menaionShortened.toLocaleString("ru")}`);
    } else {
        console.log(`Минея ЦС не найдена (${menaionRoot}) — четвёртый источник пропущен.`);
    }

    // --- 3б. Положение букв --------------------------------------------------
    //
    // Таблица «контекст → буква», выведенная из Минеи для двух спорных рядов:
    // о/ѡ/ѻ и е/є. Устройство ключа описано в @/lib/cslav/positional. Берутся
    // только решающие контексты — от двадцати вхождений и девяноста пяти
    // процентов перевеса — и только те, где стоит НЕ умолчание ряда: «о» и «е»
    // подразумеваются, и хранить их значило бы возить полсловаря ради
    // известного ответа.
    //
    // Отложенные дни в таблицу не идут: иначе проверка мерила бы, как книга
    // воспроизводит саму себя.
    const letterCounts = new Map<string, Map<string, number>>();
    for (const place of index.values()) {
        for (const [letters, seen] of place.m) {
            for (let at = 0; at < letters.length; at++) {
                if (!GROUPS.some((g) => g.includes(letters[at]))) continue;
                for (const key of contextKeys(letters, at)) {
                    const found = letterCounts.get(key) ?? new Map<string, number>();
                    found.set(letters[at], (found.get(letters[at]) ?? 0) + seen.n);
                    letterCounts.set(key, found);
                }
            }
        }
    }
    const LETTERS_MIN = 20;
    const LETTERS_SHARE = 0.95;
    const letterTable: LetterTable = {};
    for (const [key, found] of letterCounts) {
        const total = [...found.values()].reduce((sum, n) => sum + n, 0);
        if (total < LETTERS_MIN) continue;
        const [letter, n] = [...found.entries()].sort((a, b) => b[1] - a[1])[0];
        if (n / total < LETTERS_SHARE) continue;
        if (letter === defaultOf(letter)) continue;
        letterTable[key] = letter;
    }
    console.log(`положение букв: ${Object.keys(letterTable).length.toLocaleString("ru")} решающих контекстов`
        + ` из ${letterCounts.size.toLocaleString("ru")}`);

    // --- 4. Сокращения к полным словам ---------------------------------------
    //
    // Разбор отложен до конца всех трёх проходов нарочно: раскрытие костяка
    // проверяется тем, СУЩЕСТВУЕТ ЛИ полученное слово, а список слов к концу
    // первого прохода ещё не собран. Проверка не формальность: основа «бж»
    // раскрывала «бж҃е́ственнѣй» в «божственнѣй» — в слово, которого нет, — и
    // сокращение уходило под несуществующий ключ, а «божественнѣй» в указателе
    // не заводилось вовсе.
    //
    // ПОРЯДОК ПРОВЕРОК СУЩЕСТВЕН, и он не одинаков для двух таблиц. Под титлом
    // стоит и сокращение, и число («кз҃» — это 27), а по буквам они неразличимы.
    // Выверенные основы идут ПЕРЕД цифирью: костяк «гди» читается числом как 15,
    // и обратный порядок стоил 13 тысяч связок — цифирь разобрала «бг҃ъ» как 5.
    // Таблица костяков идёт ПОСЛЕ цифири: её ключи коротки, и «г҃і» (126
    // вхождений — нумерация глав в Лествице) она прочитала бы как «господи»
    // вместо тринадцати.
    //
    // Сверки две, и они о разном. Первая — для выносной, ОПУЩЕННОЙ в строку:
    // букв столько же, не на месте одна. Вторая — для титла, где буквы ОПУЩЕНЫ:
    // букв меньше, и сходиться должен порядок. Обе принимают ответ, только если
    // он единственный.
    const known = new Set(index.keys());

    const byBag = new Map<string, string[]>();
    const byEnds = new Map<string, string[]>();
    for (const full of known) {
        const bag = [...full].sort().join("");
        (byBag.get(bag) ?? byBag.set(bag, []).get(bag)!).push(full);
        const ends = `${full[0]}${full[full.length - 1]}`;
        (byEnds.get(ends) ?? byEnds.set(ends, []).get(ends)!).push(full);
    }

    /** К какому полному слову ведёт сокращение; null — не разобрано. */
    const resolve = (spelling: string): string | null | "numeral" => {
        const key = civilKey(spelling);
        const accept = (word: string | null) => (word && known.has(civilKey(word)) ? civilKey(word) : null);

        const byStem = accept(expandTitlo(key));
        if (byStem) { stats.titloByStem++; return byStem; }
        if (expandTitlo(key)) stats.titloRejected++;

        // Основа не в начале слова: приставочные сокращения. Ответ принимается
        // только единственный — из нескольких раскрытий, дающих существующее
        // слово, выбирать нечем.
        const anywhere = [...new Set(expandAnywhere(key).map(accept).filter(Boolean) as string[])];
        if (anywhere.length === 1) { stats.titloByPrefix++; return anywhere[0]; }

        // Числом читается не всё, над чем стоит титло. Буквы цифири — обычные
        // буквы, и csNumeral прочтёт числом любое слово из них: «пребл҃же́нне»
        // выходило 325, «приснодв҃о» — 584, «всест҃а́ѧ» — 708. В Минее таких
        // ложных чтений набралось 23 436. Отсюда две границы: число не длиннее
        // пяти букв (самое длинное у нас «҂аѱѯ҃д» — 1764) и не несёт выверенной
        // основы. Основа проверяется от трёх букв: у коротких она совпала бы
        // случайно.
        const numeralLike = key.length <= 5 && !(key.length >= 3 && hasSacredStem(key));
        if (numeralLike && csNumeral(spelling, { thousands: true, sign: "titlo" }) !== null) return "numeral";

        const skeleton = titloSkeleton(spelling);
        const byTable = accept(expandSkeleton(skeleton));
        if (byTable) { stats.titloByTable++; return byTable; }

        if (hasSuperscript(spelling)) {
            const lowered = skeleton.replace(/ъ$/, "");
            if (known.has(lowered)) { stats.titloByWord++; return lowered; }
            const same = (byBag.get([...lowered].sort().join("")) ?? [])
                .filter((candidate) => fitsSkeleton(lowered, key, candidate));
            if (same.length === 1) { stats.titloByOrder++; return same[0]; }
        }

        // Титло опустило буквы: ищем единственное слово, в которое костяк
        // укладывается по порядку. Края слова титло не съедает, и поиск идёт
        // среди слов с теми же первой и последней буквами.
        const ends = `${key[0]}${key[key.length - 1]}`;
        const fits = (byEnds.get(ends) ?? []).filter((candidate) => fitsContraction(key, candidate));
        if (fits.length === 1) { stats.titloByContraction++; return fits[0]; }
        return null;
    };

    const resolved = new Map<string, string | null | "numeral">();
    const linkAll = (spellings: string[], forceSynodal: boolean) => {
        for (const spelling of spellings) {
            if (!resolved.has(spelling)) resolved.set(spelling, resolve(spelling));
            const full = resolved.get(spelling)!;
            if (full === "numeral") { stats.numerals++; continue; }
            if (!full) { stats.titloUnknown++; continue; }
            const old = forceSynodal ? false : titloEra(spelling, full);
            link(full, spelling, old === "old");
            stats.titloLinked++;
        }
    };
    linkAll(pending, false);
    linkAll(bibleShort, true);
    linkAll(menaionShort, true);
    for (const place of index.values()) {
        for (const seen of place.t.values()) {
            if (seen.old) stats.titloOld += seen.n; else stats.titloSynodal += seen.n;
        }
    }

    // --- Разрешение спора ----------------------------------------------------
    interface Ranked { spelling: string; letters: string; n: number; d: number }
    const ranked = (source: Attested): Ranked[] =>
        [...source.entries()]
            .map(([letters, seen]) => ({
                letters,
                // Начертание с ударением — самое частое в группе.
                spelling: [...seen.forms.entries()].sort((a, b) => b[1] - a[1])[0][0],
                n: seen.n,
                d: seen.texts.size,
            }))
            .sort((a, b) => b.n - a.n || b.d - a.d);

    const settled = (place: Entry): { best: Ranked | null; disputed: boolean } => {
        const list = ranked(place.c);
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
        const list = ranked(place.c);
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
    const shortened = stats.shortened + bibleShort.length + menaionShort.length;
    console.log(`сокращений под титлом и с выносными: ${shortened.toLocaleString("ru")}`
        + ` (собрание ${stats.shortened.toLocaleString("ru")},`
        + ` Библия ${bibleShort.length.toLocaleString("ru")},`
        + ` Минея ${menaionShort.length.toLocaleString("ru")})`);
    console.log(`   связано с полным словом ${stats.titloLinked.toLocaleString("ru")},`
        + ` цифирь ${stats.numerals.toLocaleString("ru")},`
        + ` костяк не раскрылся у ${stats.titloUnknown.toLocaleString("ru")}`);
    console.log(`   разобрано видов написаний: по основам ${stats.titloByStem.toLocaleString("ru")}`
        + ` · по основе внутри слова ${stats.titloByPrefix.toLocaleString("ru")}`
        + ` · по таблице костяков ${stats.titloByTable.toLocaleString("ru")}`
        + ` · сверкой с собранием ${stats.titloByWord.toLocaleString("ru")}`
        + ` · с перестановкой выносной ${stats.titloByOrder.toLocaleString("ru")}`
        + ` · с опущенными буквами ${stats.titloByContraction.toLocaleString("ru")}`);
    console.log(`   отвергнуто раскрытий в несуществующее слово: ${stats.titloRejected.toLocaleString("ru")} видов`);
    console.log(`   извод: синодальных ${stats.titloSynodal.toLocaleString("ru")},`
        + ` дониконовских ${stats.titloOld.toLocaleString("ru")}`);
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

    // --- Обратная проверка по Минее ------------------------------------------
    //
    // ЧЕМ ОНА ЛУЧШЕ ПРЕДЫДУЩЕЙ. Та берёт церковнославянское слово, сворачивает
    // его в гражданку и смотрит, восстановится ли обратно, — и оценка выходит
    // верхняя: свёрнутое ложится на указатель лучше, чем набранное человеком.
    // Здесь на входе НАСТОЯЩЕЕ гражданское издание Минеи, набранное отдельно от
    // церковнославянского, и сверяется оно с настоящим церковнославянским
    // изданием того же дня. Свёртки на входе нет вовсе.
    //
    // Сверка идёт не по местам, а по дню: у гражданского слова берётся ключ, и
    // если этот ключ в церковнославянском тексте того же дня есть, наше
    // написание сверяется со всеми, какими это слово там набрано. Порядок слов
    // в двух изданиях местами расходится, а состав службы — нет.
    if (has("--check") && menaionHoldout.length) {
        const civilRoot = path.join(path.dirname(menaionRoot), "menaion");
        let comparable = 0, exact = 0, byDict = 0, byDictExact = 0, byRuleN = 0, byRuleExact = 0;
        const wrong = new Map<string, number>();
        const blocks = new Map<string, { n: number; examples: Set<string> }>();

        // Расхождение сводится к тому, какими буквами оно вызвано. Системное
        // видно сразу: «ѡ на месте о» — это правило, а не описка. Разбирать
        // надо блоками, от частого к редкому; описки останутся в хвосте, когда
        // системное будет закрыто.
        // Разбор одного блока по местам: где буквы расходятся — в окончании или
        // в корне, и какое это окончание. Пара задаётся переменной среды
        // SPLIT, например SPLIT=е,є.
        const pair = (process.env.SPLIT ?? "о,ѡ,ѻ").split(",");
        const omegaBlock = (got: string, want: string[]): string => {
            const near = want.map((w) => ({ w, d: Math.abs(w.length - got.length) }))
                .sort((a, b) => a.d - b.d)[0].w;
            if (near.length !== got.length) return "иное";
            const at: number[] = [];
            for (let i = 0; i < near.length; i++) if (near[i] !== got[i]) at.push(i);
            if (!at.length || at.some((i) => !pair.includes(got[i]) || !pair.includes(near[i]))) return "иное";
            const last = at[at.length - 1];
            const tailLen = near.length - last;
            const where = tailLen <= 4 ? `окончание «${near.slice(last)}»` : "корень или приставка";
            return `${got[last]}→${near[last]} · ${where}`;
        };

        const classify = (got: string, want: string[]): string => {
            const near = want
                .map((w) => ({ w, d: Math.abs(w.length - got.length) }))
                .sort((a, b) => a.d - b.d)[0].w;
            if (near.length === got.length) {
                const pairs: string[] = [];
                for (let i = 0; i < near.length; i++) {
                    if (near[i] !== got[i]) pairs.push(`${got[i]}→${near[i]}`);
                }
                if (!pairs.length) return "прочее";
                return pairs.length === 1 ? pairs[0] : `несколько: ${pairs.join(" ")}`;
            }
            // Разная длина: чаще всего это конечный ер или ерок.
            const longer = near.length > got.length ? near : got;
            const shorter = near.length > got.length ? got : near;
            const sign = near.length > got.length ? "+" : "−";
            if (longer.startsWith(shorter)) return `${sign}«${longer.slice(shorter.length)}» в конце`;
            return `разная длина (${got.length}/${near.length})`;
        };

        for (const { month, day } of menaionHoldout) {
            const csPath = path.join(menaionRoot, month, "text", `${day}.txt`);
            const civilPath = path.join(civilRoot, month, "text", `${day}.txt`);
            if (!fs.existsSync(csPath) || !fs.existsSync(civilPath)) continue;
            const bodyOf = (file: string) =>
                fs.readFileSync(file, "utf8").split("-".repeat(40)).slice(1).join("-".repeat(40));

            // Чем это слово набрано в церковнославянском издании этого дня.
            const attested = new Map<string, Set<string>>();
            for (const token of wordsOf(bodyOf(csPath))) {
                const spelling = csCanonical(token.replace(LEADING_MARK, "").toLowerCase());
                if (isShortened(spelling)) continue;
                const key = civilKey(spelling);
                if (!key || /[^а-яё]/.test(key)) continue;
                (attested.get(key) ?? attested.set(key, new Set()).get(key)!).add(lettersOnly(spelling));
            }

            // Текст прогоняется НАСТОЯЩИМ переводом, а не выборкой из указателя:
            // грамматический слой видит предлоги и положение слова во фразе, и
            // без него проверка засчитывала бы в ошибки то, что сервис решает
            // верно, — падежные пары и звательный.
            const civilBody = bodyOf(civilPath);
            const byWord = new Map<string, CslAnswer>();
            for (const token of wordsOf(civilBody)) {
                const key = civilKey(token.replace(LEADING_MARK, "").toLowerCase());
                if (!key || byWord.has(key)) continue;
                const place = index.get(key);
                if (!place) continue;
                byWord.set(key, {
                    word: key,
                    known: Boolean(place.c.size || place.m.size || place.x.length || place.b.size),
                    agree: null,
                    corpus: ranked(place.c).map((v) => ({ w: v.spelling, n: v.n, d: v.d })),
                    menaion: ranked(place.m).map((v) => ({ w: v.spelling, n: v.n, d: v.d })),
                    lexicon: place.x,
                    bible: [...place.b.entries()].sort((a, b) => b[1] - a[1]).map(([w, n]) => ({ w, n })),
                    titlo: [],
                });
            }
            const marked = convertWithAnswers(civilBody, byWord, { rule: true, accents: false, letters: letterTable });

            for (const piece of marked.tokens) {
                if (piece.kind === "plain") continue;
                const civil = civilKey(piece.original ?? piece.text);
                if (!civil || /[^а-яё]/.test(civil)) continue;
                const want = attested.get(civil);
                if (!want) continue;   // в церковнославянском издании этого слова нет
                comparable++;

                const got = piece.kind === "byRule" ? null
                    : lettersOnly(csCanonical(piece.text.toLowerCase()));
                if (got !== null) {
                    byDict++;
                    if (want.has(got)) { exact++; byDictExact++; }
                    else {
                        const line = `${civil}: мы «${got}», в книге «${[...want].join("», «")}»`;
                        wrong.set(line, (wrong.get(line) ?? 0) + 1);
                        const block = process.env.SPLIT
                            ? omegaBlock(got, [...want]) : classify(got, [...want]);
                        const at = blocks.get(block) ?? { n: 0, examples: new Set<string>() };
                        at.n++;
                        if (at.examples.size < 3) at.examples.add(`${got} / ${[...want][0]}`);
                        blocks.set(block, at);
                    }
                } else {
                    byRuleN++;
                    const ruled = lettersOnly(csCanonical(piece.text.toLowerCase()));
                    if (want.has(ruled)) { exact++; byRuleExact++; }
                }
            }
        }

        console.log("\n=== Обратная проверка: гражданская Минея против церковнославянской ===");
        console.log(`отложено дней: ${menaionHoldout.length}, сверяемых слов: ${comparable.toLocaleString("ru")}`);
        console.log(`по указателю: ${byDict.toLocaleString("ru")}, из них совпало`
            + ` ${byDictExact.toLocaleString("ru")} (${(byDictExact / Math.max(byDict, 1) * 100).toFixed(1)}%)`);
        console.log(`по правилу:   ${byRuleN.toLocaleString("ru")}, из них совпало`
            + ` ${byRuleExact.toLocaleString("ru")} (${(byRuleExact / Math.max(byRuleN, 1) * 100).toFixed(1)}%)`);
        console.log(`ВСЕГО СОВПАЛО: ${(exact / Math.max(comparable, 1) * 100).toFixed(1)}%`);
        console.log("Оценка честная: на входе гражданское издание, набранное отдельно,");
        console.log("свёртки на входе нет, отложенные дни в указатель не попали.");
        const total = [...blocks.values()].reduce((sum, b) => sum + b.n, 0);
        console.log(`\nРасхождений ${total.toLocaleString("ru")}. Блоками, от частого к редкому:`);
        for (const [name, b] of [...blocks.entries()].sort((a, x) => x[1].n - a[1].n).slice(0, 20)) {
            const share = (b.n / total * 100).toFixed(1);
            console.log(`   ×${String(b.n).padStart(5)}  ${share.padStart(5)}%  ${name.padEnd(22)}`
                + `  ${[...b.examples].join(" · ")}`);
        }
        const tail = [...blocks.values()].filter((b) => b.n <= 2).reduce((sum, b) => sum + b.n, 0);
        console.log(`   в хвосте (два случая и меньше на блок): ${tail.toLocaleString("ru")}`
            + " — здесь и надо будет искать описки набора, когда системное закроется");
    }

    // --- Таблица положения файлом --------------------------------------------
    if (has("--letters")) {
        const target = path.join(process.cwd(), "src", "lib", "cslav", "positionalTable.ts");
        const rows = Object.entries(letterTable).sort(([a], [b]) => a.localeCompare(b));
        fs.writeFileSync(target, `import type { LetterTable } from "@/lib/cslav/positional";

// ВЫВЕДЕНО СКРИПТОМ, руками не правится: npm run cslav:build -- --letters.
//
// Положение букв по Минее церковнославянским шрифтом: контекст спорной гласной
// → что в нём стоит. Ряды о/ѡ/ѻ и е/є; умолчания ряда («о», «е») в таблицу не
// входят. Взяты решающие контексты — от ${LETTERS_MIN} вхождений и
// ${Math.round(LETTERS_SHARE * 100)}% перевеса. Устройство ключа и порядок
// опроса описаны в @/lib/cslav/positional.
//
// Контекстов: ${rows.length.toLocaleString("ru")}.
export const LETTER_TABLE: LetterTable = {
${rows.map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n")}
};
`, "utf8");
        console.log(`\nтаблица положения записана: ${target} (${rows.length.toLocaleString("ru")} контекстов)`);
    }

    // --- Запись --------------------------------------------------------------
    if (has("--apply")) {
        const collection = client.db(DICT_DB).collection(SPELLINGS);
        const documents = [...index.entries()].map(([key, place]) => ({
            _id: key as any,
            ...(place.c.size ? {
                c: ranked(place.c).map((v): CorpusVariant => ({ w: v.spelling, n: v.n, d: v.d })),
            } : {}),
            ...(place.m.size ? {
                m: ranked(place.m).map((v): CorpusVariant => ({ w: v.spelling, n: v.n, d: v.d })),
            } : {}),
            ...(place.x.length ? { x: place.x } : {}),
            ...(place.b.size ? {
                b: [...place.b.entries()].sort((a, b) => b[1] - a[1])
                    .map(([w, n]): BibleVariant => ({ w, n })),
            } : {}),
            ...(place.t.size ? {
                // o: 1 — дониконовское сокращение. Синодальный набор так не
                // пишет, и предлагать его переводу нельзя; в указателе оно
                // остаётся свидетельством собрания.
                t: [...place.t.entries()].sort((a, b) => b[1].n - a[1].n)
                    .map(([w, seen]) => ({ w, n: seen.n, ...(seen.old ? { o: 1 } : {}) })),
            } : {}),
            // Согласие считается ПО БУКВАМ. Словарь не несёт ни звательц (их в
            // формах нет вовсе), ни того же ударения, что собрание, и сравнение
            // написаний целиком давало ложное расхождение: «ᲂу҆слы́ши» собрания
            // против «ᲂуслы́ши» словаря — одно и то же слово.
            a: place.c.size && place.x.length
                ? place.x.some((v) => lettersOnly(v.w) === ranked(place.c)[0].letters)
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

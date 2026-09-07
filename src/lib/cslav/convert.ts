import { WORD_PATTERN } from "@/lib/accents/core";
import {
    byRule, civilKey, csCanonical, DOMINANCE, hasChurchSlavonicGraphics, sentenceCase, type RuleName,
} from "@/lib/cslav/core";
import { GOVERNMENT, narrowVariants } from "@/lib/cslav/grammar";
import { contractByStem, TITLA_CONTRACTIONS } from "@/lib/cslav/titla";
import {
    agreement, onlyLettersApart, placeLetters, type LetterTable,
} from "@/lib/cslav/positional";
import { plural } from "@/utils/plural";

// Разметка гражданского текста церковнославянскими написаниями.
//
// Чистая часть: базы не знает, всё решает по ответам, которые ей подали. Так же
// устроена разметка ударений (@/lib/accents/mark), и по той же причине — чтобы
// решения проверялись тестами, а не прогоном по живому собранию.
//
// ТЕКСТ СОБИРАЕТСЯ ОБРАТНО БЕЗ ПОТЕРЬ: промежутки между словами тоже становятся
// токенами, и `tokens.map(t => t.text).join("")` даёт исходную строку, если
// ничего не выбрано.

/** Откуда взято написание. */
export type CslSource = "corpus" | "menaion" | "lexicon" | "bible" | "rule";

export interface CslVariant {
    /** Написание как оно есть в источнике. */
    spelling: string;
    /** Оно же с регистром исходного слова — это и подставляется в текст. */
    applied: string;
    /** Вхождений в собрании; у словаря и Библии своё значение (см. source). */
    count: number;
    /** В скольких текстах собрания встречено. */
    texts: number;
    /** Доля внутри источника, 0..1. */
    share: number;
    source: CslSource;
    /** Грамматические пометы словаря: «dat/loc», «brev,sg,m,gen». */
    properties?: string;
    /** Лексема словаря, от которой форма. */
    lemma?: string;
    /** Часть речи лексемы: наречие пишется омегой, краткое прилагательное — о. */
    speech?: string;
}

export type CslTokenKind =
    /** Промежуток: пробелы, знаки препинания. */
    | "plain"
    /** Переведено по засвидетельствованному написанию. */
    | "byDictionary"
    /** Спор решён падежом: предлог требует определённой формы. */
    | "byGrammar"
    /** Переведено позиционным правилом: ять и омега при этом не восстановлены. */
    | "byRule"
    /** Написаний несколько, и выбор за человеком. */
    | "ambiguous"
    /** Намеренно не тронуто: уже церковнославянское, киноварь, латиница. */
    | "untouched";

export interface CslToken {
    text: string;
    kind: CslTokenKind;
    variants?: CslVariant[];
    source?: CslSource;
    /** Какие правила приложены — у byRule и у словарных форм без звательца. */
    rules?: RuleName[];
    /** Почему не тронуто — или чем решён спор. */
    why?: string;
    /**
     * Исходное гражданское слово — только у пришедших правилом.
     *
     * Нужно, чтобы служба могла спросить о нём словарь ударений: правило даёт
     * буквы, но не ударение, а словарь ударений знает гражданские написания.
     */
    original?: string;
}

export interface ConvertResult {
    tokens: CslToken[];
    byDictionary: number;
    byGrammar: number;
    byRule: number;
    ambiguous: number;
    untouched: number;
    /** Знаменатель: сколько слов вообще подлежало переводу. */
    expected: number;
}

export interface CslAnswer {
    word: string;
    known: boolean;
    /** Сходятся ли словарь и собрание. */
    agree: boolean | null;
    corpus: Array<{ w: string; n: number; d: number }>;
    /** Минея церковнославянским шрифтом — главное свидетельство служебной титлы. */
    menaion: Array<{ w: string; n: number; d: number }>;
    lexicon: Array<{ w: string; l: string; p: string; s?: string }>;
    bible: Array<{ w: string; n: number }>;
    /** Сокращения под титлом; o: 1 — дониконовское. */
    titlo: Array<{ w: string; n: number; o?: 1 }>;
}

export interface ConvertOptions {
    /** Дописывать позиционные правила там, где словарь молчит. */
    rule: boolean;
    /** Ставить ударение словам, пришедшим правилом (делает служба). */
    accents: boolean;
    /** Предлагать сокращение под титлом там, где оно засвидетельствовано. */
    titla: boolean;
    /** Таблица положения букв; без неё спор «о»/«ѡ» и «е»/«є» решается частотой. */
    letters?: LetterTable;
}

const DEFAULTS: ConvertOptions = { rule: true, accents: true, titla: false };

const lettersOnly = (word: string) =>
    word.normalize("NFD").replace(/[̀-ͯ҃-҉]/g, "").normalize("NFC");

// Киноварь: разметка `{k|…}` в наших текстах. Внутрь неё не лезем — это не
// слова чтения, а указание устава.
const RUBRIC = /\{k\|[^}]*\}/g;

const rubricRanges = (text: string): Array<[number, number]> => {
    const ranges: Array<[number, number]> = [];
    for (const match of text.matchAll(RUBRIC)) {
        ranges.push([match.index!, match.index! + match[0].length]);
    }
    return ranges;
};

// Конец предложения: точка, восклицательный и вопросительный знаки, многоточие
// и перевод строки. Двоеточие и точка с запятой сюда не входят — после них
// предложение продолжается.
const SENTENCE_BREAK = /[.!?…\n\r]/;

const PSILI = "҆";
const VOWELS = "аеиоуыэюяєѣіѵꙋѡѧꙗᲂ";

/**
 * Звательце поверх словарной формы.
 *
 * В словаре его нет ни у одной формы из 148 204 — он их просто не хранит, — а в
 * книгах оно стоит у 94,9% слов с начальной гласной. Поэтому словарное
 * написание доводится правилом, и это отмечается в токене: читатель должен
 * видеть, что часть слова пришла не из книги.
 */
const withPsili = (word: string): { form: string; added: boolean } => {
    const first = [...word][0] ?? "";
    if (!VOWELS.includes(first.toLowerCase()) || word.includes(PSILI)) return { form: word, added: false };
    const rest = word.slice(first.length);
    const form = first === "ᲂ" && rest.startsWith("у")
        ? `${first}у${PSILI}${rest.slice(1)}`
        : `${first}${PSILI}${rest}`;
    return { form, added: true };
};

// Сокращение берётся самое частое и только если оно не единично: единичное —
// описка набора, а не принятое сокращение.
const TITLO_NOISE = 3;

// ДОНИКОНОВСКИЕ СОКРАЩЕНИЯ НЕ ПРЕДЛАГАЮТСЯ. Перевод идёт в синодальное
// написание, а старопечатный набор сокращал ради места что угодно: «ᲂу҆́мѡⷨ» —
// это «ᲂу҆́момъ» с поднятой над строкой м. Извод размечен при сборке указателя
// (см. titloEra), и в собрании такого 6 097 вхождений против 45 376 синодальных.
const shortestOf = (answer: CslAnswer): { w: string; n: number } | null => {
    const best = answer.titlo.find((v) => !v.o);
    return best && best.n >= TITLO_NOISE ? best : null;
};

/** Слова, о которых стоит спрашивать указатель. */
export const wordsToLookUp = (text: string): string[] => {
    const ranges = rubricRanges(text);
    const inRubric = (at: number) => ranges.some(([from, to]) => at >= from && at < to);

    const keys = new Set<string>();
    for (const match of text.matchAll(new RegExp(WORD_PATTERN.source, "gu"))) {
        if (inRubric(match.index!)) continue;
        if (hasChurchSlavonicGraphics(match[0])) continue;
        const key = civilKey(match[0]);
        if (key) keys.add(key);
    }
    return [...keys];
};

// Единичное написание против сотен — это описка набора, а не разночтение:
// «тѣбѣ» встречается дважды при 550 у «тебѣ̀». Предлагать такое читателю значит
// выдавать опечатку за выбор. Порог низкий и жёсткий: три вхождения, если
// написание не подтверждено словарём.
const NOISE = 3;

// МИНЕЯ ВЕДЁТ, собрание говорит там, где она молчит. Частоты не складываются:
// это разные книги, и середина между ними не значила бы ничего.
//
// Порядок выбран не по вкусу, а замером. Обратная проверка (сборка указателя,
// флаг --check) прогоняет ГРАЖДАНСКОЕ издание Минеи через перевод и сверяет с
// ЦЕРКОВНОСЛАВЯНСКИМ изданием того же дня, на отложенных днях: с Минеей впереди
// совпадает 99,0%, с собранием впереди — 97,0%. Причина видна в расхождениях:
// книги собрания аскетические, и на богослужебном тексте служебная книга —
// свидетель ближе. Собрание давало «вѣрно», «достоино», «ѡбразъ» там, где в
// службе стоят «вѣрнѡ», «достоинѡ», «ѻбразъ».
const attestedOf = (answer: CslAnswer) =>
    (answer.menaion.length
        ? answer.menaion.map((v) => ({ ...v, source: "menaion" as const }))
        : answer.corpus.map((v) => ({ ...v, source: "corpus" as const })));

const variantsOf = (answer: CslAnswer, word: string, atSentenceStart: boolean): CslVariant[] => {
    const out: CslVariant[] = [];

    const dictForms = new Set(answer.lexicon.map((v) => lettersOnly(v.w)));
    const attested = attestedOf(answer);
    const corpusTotal = attested.reduce((sum, v) => sum + v.n, 0) || 1;
    for (const v of attested) {
        if (v.n < NOISE && !dictForms.has(lettersOnly(v.w))) continue;
        const { form } = withPsili(v.w);
        out.push({
            spelling: v.w,
            applied: sentenceCase(word, form, atSentenceStart),
            count: v.n,
            texts: v.d,
            share: Number((v.n / corpusTotal).toFixed(3)),
            source: v.source,
        });
    }

    // Словарные формы идут следом. Если такое написание уже пришло из собрания,
    // словарь не заводит второй вариант, а ОТДАЁТ ЕМУ СВОЮ ПОМЕТУ: частота
    // говорит, как пишут чаще, а помета — какой это падеж, и второе для выбора
    // важнее первого. Терять помету на совпадении значило бы лишить читателя
    // ответа ровно там, где спор и возникает («тебѣ» дательный против «тебе»
    // винительного).
    for (const v of answer.lexicon) {
        const letters = lettersOnly(v.w);
        const twin = out.find((existing) => lettersOnly(existing.spelling) === letters);
        if (twin) {
            const seen = new Set((twin.properties ?? "").split(" · ").filter(Boolean));
            if (v.p) seen.add(v.p);
            twin.properties = [...seen].join(" · ") || undefined;
            twin.lemma ??= v.l || undefined;
            twin.speech ??= v.s || undefined;
            continue;
        }
        const { form } = withPsili(v.w);
        out.push({
            spelling: v.w,
            applied: sentenceCase(word, form, atSentenceStart),
            count: 0,
            texts: 0,
            share: 0,
            source: "lexicon",
            properties: v.p || undefined,
            lemma: v.l || undefined,
            speech: v.s || undefined,
        });
    }

    for (const v of answer.bible) {
        const letters = lettersOnly(v.w);
        if (out.some((existing) => lettersOnly(existing.spelling) === letters)) continue;
        const { form } = withPsili(v.w);
        out.push({
            spelling: v.w,
            applied: sentenceCase(word, form, atSentenceStart),
            count: v.n,
            texts: 0,
            share: 0,
            source: "bible",
        });
    }

    return out;
};

/**
 * Решён ли выбор написания.
 *
 * Порог тройной и по двум показателям сразу — вхождениям и числу текстов:
 * отсев по текстам существен, «ꙗ҆́кѡ» стоит в 245 текстах против девяти у
 * соперника. Словарь снимает спор, только если сам предлагает ОДНО написание:
 * когда у него их несколько, это разные падежи одного слова, и подтверждать
 * лидера чужим падежом значит решать за человека.
 */
/**
 * Спор «о» против «ѡ», решённый положением.
 *
 * Прикладывается ТОЛЬКО там, где написания разнятся одними этими буквами: если
 * они разнятся ещё чем-то, положение омеги о них не судит. И только между
 * равными по свидетельству: книга, где она говорит, остаётся выше правила.
 *
 * Возвращает переупорядоченный список, где впереди то написание, которое
 * согласно с положением; null — правило молчит или спор не о том.
 */
const byPosition = (variants: CslVariant[], table?: LetterTable): CslVariant[] | null => {
    if (!table || variants.length < 2) return null;
    const [first, second] = variants;
    // КНИГА ВЫШЕ ПРАВИЛА. Первый прогон прикладывал положение омеги ко всякой
    // паре и портил дело: 99,0% падало до 98,9%, а расхождений «о→ѡ»
    // прибавлялось с 487 до 735 — правило переставляло засвидетельствованное.
    // Поэтому оно вступает только там, где ведущее написание в книгах не
    // встречено вовсе и выбирать иначе не из чего.
    if (first.count > 0) return null;
    if (!onlyLettersApart(lettersOnly(first.spelling), lettersOnly(second.spelling))) return null;

    const a = agreement(table, lettersOnly(first.spelling));
    const b = agreement(table, lettersOnly(second.spelling));
    if (a === null || b === null || a === b) return null;
    return b > a ? [second, first, ...variants.slice(2)] : null;
};

const settled = (answer: CslAnswer): boolean => {
    const dictForms = new Set(answer.lexicon.map((v) => lettersOnly(v.w)));
    const attested = attestedOf(answer);

    if (attested.length > 1) {
        const [best, rival] = attested;
        if (dictForms.size === 1 && dictForms.has(lettersOnly(best.w))) return true;
        return best.n >= DOMINANCE * rival.n && best.d >= DOMINANCE * rival.d;
    }
    if (attested.length === 1) {
        // Книги знают одно написание; словарь может знать другие падежи.
        return dictForms.size <= 1 || dictForms.has(lettersOnly(attested[0].w));
    }
    return dictForms.size === 1 || (dictForms.size === 0 && answer.bible.length === 1);
};

/**
 * Спор о части речи, а не о падеже.
 *
 * Наречие на -о пишется омегой, краткое прилагательное среднего рода — обычным
 * о: «вѣ́рнѡ» против «вѣ́рно», «свѣ́тлѡ» против «свѣ́тло». В гражданке это
 * омонимы, и различает их только часть речи, которую из одного слова не узнать.
 * Решать за читателя тут нечем — но назвать спор по имени обязательно.
 */
const speechDispute = (variants: CslVariant[], chosen?: CslVariant): string | undefined => {
    const adverb = variants.find((v) => v.speech?.startsWith("ADV"));
    const other = variants.find((v) => v.speech && !v.speech.startsWith("ADV"));
    if (!adverb || !other) return undefined;

    const rule = "наречие пишется омегой и ятем («вѣ́рнѡ», «непоро́чнѣ»),"
        + " краткое прилагательное — обычными о и е («вѣ́рно», «непоро́чне»);"
        + " в гражданском написании это омонимы";
    if (!chosen) return rule;

    // Выбор сделан частотой, а не разбором: сказать об этом надо прямо, иначе
    // читатель примет частоту за грамматику. Таких ключей в указателе 648.
    const isAdverb = chosen.speech?.startsWith("ADV");
    const rival = isAdverb ? other : adverb;
    return `${rule}. Взято ${isAdverb ? "наречие" : "краткое прилагательное"}`
        + ` по частоте; другое чтение — «${rival.spelling}»`;
};

/** Разметка текста по готовым ответам указателя. */
export const convertWithAnswers = (
    text: string,
    byWord: Map<string, CslAnswer>,
    options: Partial<ConvertOptions> = {},
): ConvertResult => {
    const settings = { ...DEFAULTS, ...options };
    const ranges = rubricRanges(text);
    const inRubric = (at: number) => ranges.some(([from, to]) => at >= from && at < to);

    const tokens: CslToken[] = [];
    let cursor = 0;
    let byDictionary = 0;
    let byGrammar = 0;
    let byRuleCount = 0;
    let ambiguous = 0;
    let untouched = 0;
    let expected = 0;

    // Предлог, стоящий перед разбираемым словом. Держим его отдельно, а не
    // ищем назад по токенам: между предлогом и словом бывает только пробел, и
    // всё, что сложнее, — уже не управление.
    let preposition: string | null = null;

    // Прописная в церковнославянском отмечает начало предложения, и только его:
    // ни имя, ни священное слово её не несут. Значит регистр берётся отсюда, а
    // не с гражданского слова, где «Бог» и «Иоанн» стоят по русской норме.
    let atSentenceStart = true;

    for (const match of text.matchAll(new RegExp(WORD_PATTERN.source, "gu"))) {
        const word = match[0];
        const at = match.index!;
        const gap = at > cursor ? text.slice(cursor, at) : "";
        if (gap) tokens.push({ text: gap, kind: "plain" });
        cursor = at + word.length;

        // Управление рвётся всем, кроме пробела: запятая между предлогом и
        // словом значит, что это уже другое место в предложении.
        const carried = preposition;
        const governing = /^\s*$/.test(gap) ? carried : null;

        // Знак конца предложения или перевод строки в промежутке — начало новой
        // фразы. Считывается один раз: выходов из разбора слова много, и забыть
        // сбросить признак проще всего на одном из них.
        if (SENTENCE_BREAK.test(gap)) atSentenceStart = true;
        const first = atSentenceStart;
        atSentenceStart = false;

        // Само это слово может быть предлогом для следующего. Запоминаем сразу,
        // до всех ветвлений: выходов из разбора слова много, и забыть на одном
        // из них проще всего.
        const key = civilKey(word);
        preposition = key in GOVERNMENT ? key : null;

        if (inRubric(at)) {
            tokens.push({ text: word, kind: "untouched", why: "киноварь" });
            untouched++;
            continue;
        }
        if (hasChurchSlavonicGraphics(word)) {
            tokens.push({ text: word, kind: "untouched", why: "уже церковнославянское написание" });
            untouched++;
            continue;
        }

        expected++;
        const answer = byWord.get(key);
        const variants = answer ? variantsOf(answer, word, first) : [];

        // Сокращение под титлом — по явному запросу и только
        // засвидетельствованное: как напечатано в книгах, так и предлагаем.
        // Само оно не строится: сокращать или нет — выбор издателя, а не
        // орфография, и одно и то же слово в одной книге под титлом, а в
        // другой полностью.
        //
        // Спрашивается РАНЬШЕ спора о написании, и это существенно. Сокращение
        // спор снимает: «хрⷭ҇то́во» не содержит ни и, ни і, о которых спор шёл, —
        // и держать слово спорным, имея готовое печатное сокращение, незачем.
        // Оно же — единственное написание там, где слово в книгах полностью не
        // печатается вовсе.
        const short = settings.titla && answer ? shortestOf(answer) : null;
        if (short) {
            const spelling = variants[0]?.spelling ?? word;
            tokens.push({
                text: sentenceCase(word, short.w, first),
                kind: "byDictionary",
                source: variants[0]?.source ?? "corpus",
                rules: ["титло"],
                why: `«${spelling}» под титлом; так напечатано ${short.n} `
                    + plural(short.n, "раз", "раза", "раз"),
            });
            byDictionary++;
            continue;
        }

        if (variants.length && settled(answer!)) {
            // Положение омеги решает и там, где спор считался решённым, — но
            // лишь когда решён он был словарём, а не книгой (см. byOmega).
            const reordered = byPosition(variants, settings.letters);
            if (reordered) variants.splice(0, variants.length, ...reordered);
            const best = variants[0];
            const rules: RuleName[] = withPsili(best.spelling).added ? ["звательце"] : [];

            // Сокращения в книгах нет, но основа сокращается в них всегда:
            // собрание наше — книги аскетические, не богослужебные, и
            // «пребл҃же́нне» в нём просто не встречается. Строим по образцу.
            const built = settings.titla ? contractByStem(best.applied) : null;
            if (built) {
                tokens.push({
                    text: built.form,
                    kind: "byDictionary",
                    source: best.source,
                    rules: [...rules, "титло"],
                    why: `сокращения этого слова в книгах нет; построено по образцу основы`
                        + ` «${built.stem}» → «${TITLA_CONTRACTIONS[built.stem]}»`,
                });
                byDictionary++;
                continue;
            }

            tokens.push({
                text: best.applied,
                kind: "byDictionary",
                source: best.source,
                rules: rules.length ? rules : undefined,
                why: speechDispute(variants, best),
            });
            byDictionary++;
            continue;
        }
        if (variants.length > 1) {
            // Спор о написании — это спор о падеже: его задаёт предлог, а где
            // предлога нет — само его отсутствие (звательный против местного).
            const narrowed = narrowVariants(variants, governing);
            const ordered = byPosition(narrowed?.variants ?? variants, settings.letters)
                ?? narrowed?.variants ?? variants;
            if (narrowed?.decided) {
                tokens.push({
                    text: ordered[0].applied,
                    kind: "byGrammar",
                    source: ordered[0].source,
                    variants: ordered,
                    why: narrowed.why,
                });
                byGrammar++;
            } else {
                tokens.push({
                    text: ordered[0].applied,
                    kind: "ambiguous",
                    variants: ordered,
                    why: narrowed?.why ?? speechDispute(ordered),
                });
                ambiguous++;
            }
            continue;
        }

        if (!settings.rule) {
            tokens.push({ text: word, kind: "untouched", why: "указатель этого слова не знает" });
            untouched++;
            continue;
        }
        // Неизвестное слово всё равно доводится правилом — и когда правилу в
        // нём нечего менять. Иначе в готовом тексте остаётся гражданское
        // вкрапление, и списать его целиком нельзя.
        const ruled = byRule(word);

        // ЗДЕСЬ ПОЛОЖЕНИЕ БУКВ И РАБОТАЕТ. Там, где книги слово знают, они и
        // отвечают; правилу же достаётся незнакомое, и без таблицы оно ставило
        // бы одно «о» всюду. Замер на отложенных днях Минеи: таблица верна в
        // 98,9% поставленных омег, мест угадано 92,2% против 83,1% у «всегда о».
        const placed = placeLetters(ruled.form, settings.letters);
        tokens.push({
            text: sentenceCase(word, placed.form, first),
            kind: "byRule",
            source: "rule",
            rules: placed.changed ? [...ruled.applied, "положение"] : ruled.applied,
            original: word,
        });
        byRuleCount++;
    }

    if (cursor < text.length) tokens.push({ text: text.slice(cursor), kind: "plain" });

    return { tokens, byDictionary, byGrammar, byRule: byRuleCount, ambiguous, untouched, expected };
};

/** Готовый текст с учётом выбранного человеком. */
export const toPlainText = (tokens: CslToken[], chosen: Record<number, string> = {}): string =>
    tokens.map((token, index) => chosen[index] ?? token.text).join("");

/** Канон написания — вынесен наружу для проверок и сборки указателя. */
export { csCanonical };

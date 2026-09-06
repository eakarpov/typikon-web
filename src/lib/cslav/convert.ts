import { WORD_PATTERN } from "@/lib/accents/core";
import {
    byRule, civilKey, csCanonical, DOMINANCE, hasChurchSlavonicGraphics, matchCase, type RuleName,
} from "@/lib/cslav/core";
import { GOVERNMENT, narrowByPreposition } from "@/lib/cslav/grammar";
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
export type CslSource = "corpus" | "lexicon" | "bible" | "rule";

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
    lexicon: Array<{ w: string; l: string; p: string }>;
    bible: Array<{ w: string; n: number }>;
    titlo: Array<{ w: string; n: number }>;
}

export interface ConvertOptions {
    /** Дописывать позиционные правила там, где словарь молчит. */
    rule: boolean;
    /** Ставить ударение словам, пришедшим правилом (делает служба). */
    accents: boolean;
    /** Предлагать сокращение под титлом там, где оно засвидетельствовано. */
    titla: boolean;
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

const shortestOf = (answer: CslAnswer): { w: string; n: number } | null => {
    const best = answer.titlo[0];
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

const variantsOf = (answer: CslAnswer, word: string): CslVariant[] => {
    const out: CslVariant[] = [];

    const dictForms = new Set(answer.lexicon.map((v) => lettersOnly(v.w)));
    const corpusTotal = answer.corpus.reduce((sum, v) => sum + v.n, 0) || 1;
    for (const v of answer.corpus) {
        if (v.n < NOISE && !dictForms.has(lettersOnly(v.w))) continue;
        const { form } = withPsili(v.w);
        out.push({
            spelling: v.w,
            applied: matchCase(word, form),
            count: v.n,
            texts: v.d,
            share: Number((v.n / corpusTotal).toFixed(3)),
            source: "corpus",
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
            continue;
        }
        const { form } = withPsili(v.w);
        out.push({
            spelling: v.w,
            applied: matchCase(word, form),
            count: 0,
            texts: 0,
            share: 0,
            source: "lexicon",
            properties: v.p || undefined,
            lemma: v.l || undefined,
        });
    }

    for (const v of answer.bible) {
        const letters = lettersOnly(v.w);
        if (out.some((existing) => lettersOnly(existing.spelling) === letters)) continue;
        const { form } = withPsili(v.w);
        out.push({
            spelling: v.w,
            applied: matchCase(word, form),
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
const settled = (answer: CslAnswer): boolean => {
    const dictForms = new Set(answer.lexicon.map((v) => lettersOnly(v.w)));

    if (answer.corpus.length > 1) {
        const [best, rival] = answer.corpus;
        if (dictForms.size === 1 && dictForms.has(lettersOnly(best.w))) return true;
        return best.n >= DOMINANCE * rival.n && best.d >= DOMINANCE * rival.d;
    }
    if (answer.corpus.length === 1) {
        // Собрание знает одно написание; словарь может знать другие падежи.
        return dictForms.size <= 1 || dictForms.has(lettersOnly(answer.corpus[0].w));
    }
    return dictForms.size === 1 || (dictForms.size === 0 && answer.bible.length === 1);
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
        const variants = answer ? variantsOf(answer, word) : [];

        if (variants.length && settled(answer!)) {
            const best = variants[0];
            const rules: RuleName[] = withPsili(best.spelling).added ? ["звательце"] : [];

            // Сокращение под титлом — по явному запросу и только
            // засвидетельствованное: как напечатано в книгах, так и предлагаем.
            // Само оно не строится: сокращать или нет — выбор издателя, а не
            // орфография, и одно и то же слово в одной книге под титлом, а в
            // другой полностью.
            const short = settings.titla ? shortestOf(answer!) : null;
            if (short) {
                tokens.push({
                    text: matchCase(word, short.w),
                    kind: "byDictionary",
                    source: best.source,
                    rules: [...rules, "титло"],
                    why: `«${best.spelling}» под титлом; так напечатано ${short.n} `
                        + plural(short.n, "раз", "раза", "раз"),
                });
            } else {
                tokens.push({
                    text: best.applied,
                    kind: "byDictionary",
                    source: best.source,
                    rules: rules.length ? rules : undefined,
                });
            }
            byDictionary++;
            continue;
        }
        if (variants.length > 1) {
            // Спор о написании — это спор о падеже, и предлог его задаёт.
            const narrowed = narrowByPreposition(variants, governing);
            const ordered = narrowed?.variants ?? variants;
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
                    why: narrowed?.why,
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
        const ruled = byRule(word);
        if (!ruled.applied.length) {
            tokens.push({ text: word, kind: "untouched", why: "указатель этого слова не знает" });
            untouched++;
            continue;
        }
        tokens.push({
            text: matchCase(word, ruled.form),
            kind: "byRule",
            source: "rule",
            rules: ruled.applied,
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

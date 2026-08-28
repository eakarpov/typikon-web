import {
    DOMINANCE,
    EXPECTED_SHARE,
    hasAccent,
    isAbbreviated,
    isInRubric,
    MARK_NAMES,
    MIN_EVIDENCE,
    placeAccent,
    rubricRanges,
    stripAccents,
    syllables,
    WORD_PATTERN,
    type AccentAnswer,
} from "@/lib/accents/core";

// Расстановка ударений в присланном тексте — единственное место, где это делается.
// Им пользуются страница «Ударения», подсказка в отекстовке и показ на странице
// чтения; развести их по трём реализациям значило бы получить три разных ответа
// на один и тот же текст.
//
// Правило простое и намеренно осторожное: ставим знак только там, где собрание
// отвечает однозначно. Спорное слово остаётся без знака и возвращается с вариантами —
// выбирает человек. Инструмент, который угадывает молча, хуже, чем инструмент,
// который честно говорит «здесь надвое».

/** Какой набор частот брать: прозаические чтения или гимнография. */
export type Genre = "reading" | "chant";

export type TokenKind =
    /** Не слово, либо слово, которого мы не трогаем: клитика, под титлом, уже с знаком. */
    | "plain"
    /** Знак поставлен нами. */
    | "marked"
    /** Собрание даёт два живых положения — выбирает человек. */
    | "ambiguous"
    /** Слова нет ни в одном источнике. */
    | "unknown";

export interface TokenVariant {
    spelling: string;
    vowel: number;
    mark: string;
    markName: string;
    count: number;
    share: number;
    /** Написание исходного слова с этим ударением — его и подставляем в текст. */
    applied: string;
}

export interface Token {
    text: string;
    kind: TokenKind;
    /** Только у ambiguous: из чего выбирать. */
    variants?: TokenVariant[];
    /** Откуда взято решение — чтобы можно было показать, что жанр не тот. */
    source?: "corpus" | "chants" | "lexicon";
}

export interface MarkResult {
    tokens: Token[];
    marked: number;
    ambiguous: number;
    unknown: number;
    /** Слов, которым знак положен, — знаменатель для «расставлено N из M». */
    expected: number;
}

// Порядок обращения к источникам. Свой жанр первым, затем соседний, затем словарь:
// у словаря нет частот, но есть формы, которых не встретилось ни в книгах, ни в
// песнопениях, и для редкого слова это единственный ответ.
const sourceOrder = (genre: Genre): ("corpus" | "chants" | "lexicon")[] =>
    genre === "chant" ? ["chants", "corpus", "lexicon"] : ["corpus", "chants", "lexicon"];

interface Position {
    vowel: number;
    mark: string;
    spelling: string;
    count: number;
}

// Сводим варианты по ГЛАСНОЙ, а не по паре «гласная + знак». Оксия и вария на одном
// слоге — это одно и то же ударение: вид знака зависит от места во фразе, а не от
// слова. Без этой сводки «сотворѝ ×1015 / сотвори́ ×948» выглядело бы неразрешимым
// спором, хотя ударение в обоих написаниях на одной букве.
//
// Какой знак ставить — берём преобладающий у этой гласной. Точнее мы не знаем:
// вария ставится в конце колона, а где кончится колон, из отдельного слова не видно.
const byVowel = (positions: Position[]): Position[] => {
    const grouped = new Map<number, Position>();

    for (const position of positions) {
        const existing = grouped.get(position.vowel);
        if (!existing) {
            grouped.set(position.vowel, { ...position });
            continue;
        }
        // Знак и написание — от самого частого варианта этой гласной.
        if (position.count > existing.count) {
            existing.mark = position.mark;
            existing.spelling = position.spelling;
        }
        existing.count += position.count;
    }

    return [...grouped.values()].sort((a, b) => b.count - a.count);
};

const positionsFrom = (answer: AccentAnswer, source: "corpus" | "chants" | "lexicon"): Position[] => {
    if (source === "lexicon") {
        // У словаря вместо частоты — число форм парадигмы, давших это положение.
        return answer.lexicon.map((variant) => ({
            vowel: variant.vowel,
            mark: variant.mark,
            spelling: variant.spelling,
            count: variant.forms,
        }));
    }

    return answer[source].map((variant) => ({
        vowel: variant.vowel,
        mark: variant.mark,
        spelling: variant.spelling,
        count: variant.count,
    }));
};

// Положен ли слову знак вообще. Предлоги и частицы («и», «же», «бо», «на») его не
// несут, и без этой проверки инструмент принялся бы лепить ударения на них.
const takesAccent = (answer: AccentAnswer): boolean => {
    const accented = [...answer.corpus, ...answer.chants]
        .reduce((sum, variant) => sum + variant.count, 0);

    // По словарю судить о частотности нельзя: там у каждой формы своя строка,
    // а не число вхождений. Если из книг сведений нет — доверяем словарю: он
    // порождает только знаменательные слова.
    if (!accented) return answer.lexicon.length > 0;
    if (accented < MIN_EVIDENCE) return false;

    return (answer.accentedShare ?? 0) >= EXPECTED_SHARE;
};

const toVariant = (word: string, position: Position): TokenVariant | null => {
    const applied = placeAccent(word, position.vowel, position.mark);
    // Тот же инвариант, что в скриптах: снимаем поставленный знак и обязаны
    // получить исходное слово в точности, иначе правка задела что-то ещё.
    if (!applied || stripAccents(applied) !== word) return null;

    return {
        spelling: position.spelling,
        vowel: position.vowel,
        mark: position.mark,
        markName: MARK_NAMES[position.mark] ?? position.mark,
        count: position.count,
        share: 0,
        applied,
    };
};

const decide = (word: string, answer: AccentAnswer, genre: Genre): Token => {
    if (!answer.known) return { text: word, kind: "unknown" };
    if (!takesAccent(answer)) return { text: word, kind: "plain" };

    for (const source of sourceOrder(genre)) {
        const positions = byVowel(positionsFrom(answer, source));
        if (!positions.length) continue;

        const variants = positions
            .map((position) => toVariant(word, position))
            .filter(Boolean) as TokenVariant[];
        if (!variants.length) continue;

        const total = variants.reduce((sum, variant) => sum + variant.count, 0);
        variants.forEach((variant) => {
            variant.share = total ? Number((variant.count / total).toFixed(3)) : 0;
        });

        const [best, rival] = variants;
        const settled = !rival || best.count >= DOMINANCE * rival.count;

        if (settled) return { text: best.applied, kind: "marked", source };
        return { text: word, kind: "ambiguous", variants, source };
    }

    // Слово в словаре есть, но поставить знак не удалось (например, гласных нет).
    return { text: word, kind: "plain" };
};

/** Слова текста, о которых стоит спрашивать словарь. */
export const wordsToLookUp = (text: string): string[] => {
    const ranges = rubricRanges(text);
    const pattern = new RegExp(WORD_PATTERN.source, "g");
    const words = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text))) {
        const word = match[0];
        if (isInRubric(ranges, match.index)) continue;
        if (isAbbreviated(word) || syllables(word) === 0 || hasAccent(word)) continue;
        words.add(word);
    }

    return [...words];
};

/**
 * Чистая часть разметки: текст плюс уже полученные ответы словаря. Вынесена
 * отдельно, чтобы её можно было проверить тестами без базы.
 *
 * Возвращает текст целиком, кусками: пробелы и знаки препинания — такие же
 * токены, поэтому текст собирается обратно без потерь.
 */
export const markWithAnswers = (
    text: string,
    byWord: Map<string, AccentAnswer>,
    genre: Genre = "reading",
): MarkResult => {
    const ranges = rubricRanges(text);
    const pattern = new RegExp(WORD_PATTERN.source, "g");

    interface Found { word: string; at: number; skip: boolean }
    const found: Found[] = [];
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text))) {
        const word = match[0];
        const skip = isInRubric(ranges, match.index)
            || isAbbreviated(word)
            || syllables(word) === 0
            || hasAccent(word);
        found.push({ word, at: match.index, skip });
    }

    const tokens: Token[] = [];
    const result: MarkResult = { tokens, marked: 0, ambiguous: 0, unknown: 0, expected: 0 };
    let cursor = 0;

    for (const item of found) {
        if (item.at > cursor) tokens.push({ text: text.slice(cursor, item.at), kind: "plain" });
        cursor = item.at + item.word.length;

        if (item.skip) {
            tokens.push({ text: item.word, kind: "plain" });
            continue;
        }

        const answer = byWord.get(item.word);
        const token = answer ? decide(item.word, answer, genre) : { text: item.word, kind: "unknown" as const };

        // Односложное слово, которого нет в собраниях, почти всегда частица:
        // отмечать его как «неизвестное» значит забивать отчёт шумом.
        if (token.kind === "unknown" && syllables(item.word) < 2) {
            tokens.push({ text: item.word, kind: "plain" });
            continue;
        }

        if (token.kind === "marked") { result.marked++; result.expected++; }
        else if (token.kind === "ambiguous") { result.ambiguous++; result.expected++; }
        else if (token.kind === "unknown") result.unknown++;

        tokens.push(token);
    }

    if (cursor < text.length) tokens.push({ text: text.slice(cursor), kind: "plain" });

    return result;
};

/**
 * Обратная сборка в строку. chosen — что человек выбрал в спорных местах,
 * по порядковому номеру токена; невыбранные спорные остаются без знака.
 */
export const toPlainText = (tokens: Token[], chosen: Record<number, string> = {}): string =>
    tokens.map((token, index) => chosen[index] ?? token.text).join("");

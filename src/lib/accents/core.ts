// Ударения церковнославянского набора: разбор слова на буквы и знаки, словарь
// ударных форм по собственному корпусу.
//
// Знаков ударения три, а не один: оксия (острое, U+0301), вария (тупое, U+0300)
// и камора (облечённое, U+0311). Скрипт, который ищет только оксию, не увидит
// примерно четверти разметки — в Елизаветинской Библии вария стоит в 64 тысячах
// стихов, камора в 11 тысячах.
//
// Всё остальное надстрочное — не ударение, и путать нельзя:
//   U+0486 псили (звательце) — 350 тыс. вхождений, стоит над начальной гласной;
//   U+0483 титло и U+0487 покрытие — сокращение священных имён (бж҃їѧ, і҆и҃са);
//   U+033E ерок — заменяет ъ внутри слова (под̾кра́сити, и҆з̾ ни́хъ);
//   U+0308 и U+0306 — разложенные ї и й: в части текстов (Лествица, Маргарит)
//     они записаны как і+◌̈ и и+◌̆, а не одним знаком.
// Поэтому «стоит ли ударение на гласной» нельзя проверять по соседнему символу:
// между буквой и ударением законно помещается ещё один-два знака.

export const OXIA = "́";
export const VARIA = "̀";
export const KAMORA = "̑";

export const ACCENTS = [OXIA, VARIA, KAMORA];

const ACCENT_SET = new Set(ACCENTS);

// Вария сплошь и рядом записана одним символом, а не буквой со знаком: ѐ (U+0450)
// и ѝ (U+045D) — это «е» и «и» с уже вросшим тупым ударением. В Елизаветинской
// Библии так набрано 12 756 стихов с ѝ и 10 190 с ѐ. Если считать их обычными
// буквами, целый пласт ударных форм в словарь не попадёт.
//
// Заметьте: й (U+0439) и ї (U+0457) сюда НЕ относятся — краткая и двоеточие
// принадлежат самой букве, ударения в них нет.
const PRECOMPOSED: Record<string, string> = { "ѐ": "е", "ѝ": "и", "Ѐ": "Е", "Ѝ": "И" };

// А вот ѓ (U+0453) и ќ (U+045C) — македонские буквы, и в церковнославянском их
// быть не может: это согласная с приросшим ударением, то есть та же сбитая
// разметка, только одним символом. В корпусе нашлись в трёх текстах. Разворачиваем
// их так же, но с оксией — и дальше они честно попадают в разряд ошибок.
const PRECOMPOSED_WRONG: Record<string, string> = { "ѓ": "г", "ќ": "к", "Ѓ": "Г", "Ќ": "К" };

const PRECOMPOSED_ANY = /[ѐѝЀЍѓќЃЌ]/;

export const hasPrecomposedAccent = (word: string) => PRECOMPOSED_ANY.test(word);

// Разворачивает вросшее ударение обратно в букву со знаком: нужно и для ключа
// словаря, и чтобы посчитать, на какой по счёту гласной стоит знак, и чтобы
// съехавшее на согласную ударение вообще стало видно.
export const unfoldPrecomposed = (word: string) =>
    word.replace(/[ѐѝЀЍ]/g, (ch) => PRECOMPOSED[ch] + VARIA)
        .replace(/[ѓќЃЌ]/g, (ch) => PRECOMPOSED_WRONG[ch] + OXIA);

// Весь диапазон надстрочного, что встречается в корпусе: комбинирующая диакритика
// латиницы/кириллицы, церковнославянские знаки и вязь U+A66F.
const COMBINING = /[̀-ͯ҃-҉꙯]/;

// Гласные гражданки и церковнославянской графики. ѯ и ѱ сюда не идут: это кс и пс,
// сочетания согласных, ударение на них не ставится.
//
// ᲂ, ᲇ и ᲈ (Cyrillic Extended-C) — это варианты начертания о, ѣ и ꙋ из старой
// графики: в Маргарите и Ифике ударение стоит прямо на них, и без них проверка
// принимает верное написание за ошибку. Остальные буквы этого блока (ᲀ, ᲁ, ᲃ, ᲄ,
// ᲅ, ᲆ) — согласные и ъ, им здесь не место.
const VOWELS = "аеёиоуыэюяєѣіїѵѷѡѻꙋѹѧѫꙗѩѭѐѝᲂᲇᲈ";

// Слово — буквы вместе с надстрочными знаками. Ерок U+033E тоже внутрь слова:
// «и҆з̾ ни́хъ» — это два слова, а не три.
//
// Диапазон U+1C80–U+1C88 (Cyrillic Extended-C) обязателен: в текстах, набранных
// старой графикой (Маргарит, Ифика, Алфавит), стоят ᲂ, ᲅ, Ᲊ и прочие варианты
// букв. Без них слово рвётся посередине, и проверка ударения видит обрывок.
const LETTER = "а-яёА-ЯЁЀ-ԯᲀ-ᲈꙀ-ꚟ";
export const WORD_PATTERN = new RegExp(`[${LETTER}][${LETTER}\u0300-\u036f\u0483-\u0489\ua66f]*`, "g");

export const isAccent = (ch: string) => ACCENT_SET.has(ch);
export const isCombining = (ch: string) => COMBINING.test(ch);
export const isVowel = (ch: string) => VOWELS.includes(ch.toLowerCase());

export const hasAccent = (word: string) =>
    [...word].some(isAccent) || hasPrecomposedAccent(word);

// Титло и покрытие означают сокращение: бж҃їѧ — это «Божия», слово написано не
// целиком. Ударение в таких словах по традиции не ставится, и требовать его нельзя.
export const isAbbreviated = (word: string) => /[҃҇]/.test(word);

export const stripAccents = (word: string) =>
    [...unfoldPrecomposed(word)].filter((ch) => !isAccent(ch)).join("");

export const stripMarks = (word: string) =>
    [...word].filter((ch) => !isCombining(ch)).join("");

// Ключ словаря: слово без всякой надстрочной разметки, в нижнем регистре.
// Вросшее ударение сначала разворачивается, иначе «сотворѝ» и «сотвори́»
// оказались бы разными словами.
export const accentKey = (word: string) => stripMarks(unfoldPrecomposed(word)).toLowerCase();

export const syllables = (word: string) =>
    [...stripMarks(word)].filter(isVowel).length;

// Номер гласной (с нуля), на которой стоит ударение, и сам знак. Вросшее ударение
// разворачивается, поэтому «сотворѝ» отвечает так же, как «сотворѝ».
export const accentedVowel = (word: string): { index: number; mark: string } | null => {
    const chars = [...unfoldPrecomposed(word)];
    let vowels = -1;

    for (let i = 0; i < chars.length; i++) {
        if (isVowel(chars[i]) && !isCombining(chars[i])) {
            vowels++;
            continue;
        }
        if (isAccent(chars[i]) && vowels >= 0) {
            return { index: vowels, mark: chars[i] };
        }
    }

    return null;
};

// Буква, к которой относится знак в позиции index: отступаем назад через всю
// диакритику. Без этого «а҆́ще» (а + псили + оксия) читается как ударение на
// псили, то есть как ошибка, хотя написано верно.
export const baseLetterBefore = (chars: string[], index: number): { letter: string | null; at: number } => {
    for (let i = index - 1; i >= 0; i--) {
        if (!isCombining(chars[i])) return { letter: chars[i], at: i };
    }
    return { letter: null, at: -1 };
};

export interface AccentIssue {
    kind: "on-consonant" | "at-start" | "doubled" | "crowded";
    word: string;
    // Позиция знака внутри слова — для точечной правки без пересборки слова.
    at: number;
    mark: string;
    base: string | null;
}

// Разбор одного слова: что со знаками не так. Пустой список — всё в порядке.
export const findAccentIssues = (word: string): AccentIssue[] => {
    // Разбираем развёрнутое написание: иначе «яќо» выглядит безупречным словом
    // из трёх букв, хотя ударение в нём стоит на согласной.
    const chars = [...unfoldPrecomposed(word)];
    const issues: AccentIssue[] = [];
    let accentCount = 0;

    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        if (!isAccent(ch)) continue;
        accentCount++;

        const previous = chars[i - 1];

        if (previous === undefined) {
            issues.push({ kind: "at-start", word, at: i, mark: ch, base: null });
            continue;
        }

        if (isAccent(previous)) {
            issues.push({ kind: "doubled", word, at: i, mark: ch, base: null });
            continue;
        }

        const { letter } = baseLetterBefore(chars, i);
        if (!letter || !isVowel(letter)) {
            issues.push({ kind: "on-consonant", word, at: i, mark: ch, base: letter });
        }
    }

    // Больше двух знаков ударения на слово — почти всегда сбой разметки, но
    // чинить вслепую нечего: только показываем.
    if (accentCount > 2) {
        issues.push({ kind: "crowded", word, at: -1, mark: "", base: null });
    }

    return issues;
};

// --- словарь ударений -------------------------------------------------------
//
// Ключ — слово без надстрочной разметки, значение — варианты УДАРЕНИЯ, а не
// написания. Разница существенная: «а́дова» и «а҆́дова» различаются звательцем,
// ударение в обоих на одной и той же гласной, и считать их спорной парой нельзя.
// Группировка по позиции снимает 1408 таких ложных разночтений.

export interface StressVariant {
    // Номер ударной гласной, считая с нуля.
    index: number;
    // Оксия, вария или камора.
    mark: string;
    // Сколько раз встретилось это ударение.
    count: number;
    // Самое частое написание — для показа человеку и для внешних потребителей.
    spelling: string;
}

// Варианты отсортированы по убыванию частоты.
export type AccentDictionary = Map<string, StressVariant[]>;

interface VariantDraft {
    index: number;
    mark: string;
    count: number;
    spellings: Map<string, number>;
}

export type DictionaryDraft = Map<string, Map<string, VariantDraft>>;

export const createDraft = (): DictionaryDraft => new Map();

// Слово идёт в словарь, только если ударение в нём стоит верно: иначе сбитая
// форма голосовала бы сама за себя, а у редкого слова могла бы оказаться единственной.
export const addWord = (draft: DictionaryDraft, word: string) => {
    if (!hasAccent(word) || findAccentIssues(word).length) return;

    const key = accentKey(word);
    if (key.length < 2) return;

    const lower = word.toLowerCase();
    const stress = accentedVowel(lower);
    if (!stress) return;

    const variants = draft.get(key) ?? new Map<string, VariantDraft>();
    const variantKey = `${stress.index}${stress.mark}`;
    const variant = variants.get(variantKey)
        ?? { index: stress.index, mark: stress.mark, count: 0, spellings: new Map<string, number>() };

    variant.count++;
    variant.spellings.set(lower, (variant.spellings.get(lower) ?? 0) + 1);
    variants.set(variantKey, variant);
    draft.set(key, variants);
};

export const addContent = (draft: DictionaryDraft, content: string) => {
    for (const word of content.match(WORD_PATTERN) ?? []) addWord(draft, word);
};

export const finalize = (draft: DictionaryDraft): AccentDictionary => {
    const dictionary: AccentDictionary = new Map();

    for (const [key, variants] of draft) {
        const list = [...variants.values()]
            .map((variant) => ({
                index: variant.index,
                mark: variant.mark,
                count: variant.count,
                spelling: [...variant.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0],
            }))
            .sort((a, b) => b.count - a.count);
        dictionary.set(key, list);
    }

    return dictionary;
};

// Насколько уверенно словарь отвечает за это слово.
//   sure    — ударение везде на одной гласной;
//   likely  — одно положение перевешивает остальные на порядок (у редких
//             вариантов обычно сбит знак, их-то мы и чиним);
//   unsure  — настоящее разночтение (ру́ку и руку́ обе живые), решать нельзя.
export type Confidence = "sure" | "likely" | "unsure";

export const DOMINANCE = 10;

// --- словарная запись --------------------------------------------------------
//
// Форма ответа словаря. Живёт в ядре, а не рядом с доступом к базе: на неё
// смотрит и разметка текста, которой база не нужна вовсе.

/** Как называется знак — для показа человеку; внутри везде сам символ. */
export const MARK_NAMES: Record<string, string> = {
    [OXIA]: "оксия",
    [VARIA]: "вария",
    [KAMORA]: "камора",
};

/** Засвидетельствовано в собрании: где стоит знак и сколько раз так написано. */
export interface CorpusVariant {
    /** Номер ударной гласной с нуля — не позиция символа: та зависит от того,
     *  разложены ли ї и й, а номер гласной не зависит. */
    vowel: number;
    mark: string;
    spelling: string;
    count: number;
}

/** Порождено словарём: та же позиция плюс грамматика. */
export interface LexiconVariant {
    vowel: number;
    mark: string;
    spelling: string;
    lexeme: string;
    properties: string;
    /** Сколько форм словаря дали это положение ударения. */
    forms: number;
}

export interface AccentAnswer {
    word: string;
    known: boolean;
    agree: boolean | null;
    corpus: (CorpusVariant & { markName: string; share: number })[];
    chants: (CorpusVariant & { markName: string; share: number })[];
    lexicon: (LexiconVariant & { markName: string })[];
    /** Положен ли этому слову знак вообще: доля размеченных написаний в собраниях.
     *  Предлоги и частицы держатся у нуля, знаменательные слова — у единицы. */
    accentedShare: number | null;
}

// --- ставится ли слову ударение вообще ---------------------------------------
//
// В церковнославянском наборе знак несут не все слова: предлоги и частицы («и»,
// «же», «бо», «на») стоят без него, и требовать от них ударения — значит принять
// верный набор за пропуск. Правило берём из самого корпуса: если слово размечено
// не реже чем в девяти случаях из десяти, знак ему положен.

export interface AccentStats {
    accented: number;
    plain: number;
}

export type AccentRates = Map<string, AccentStats>;

export const createRates = (): AccentRates => new Map();

export const addRates = (rates: AccentRates, content: string) => {
    for (const word of content.match(WORD_PATTERN) ?? []) {
        // Сокращения под титлом и слова без гласных в счёт не идут вовсе.
        if (isAbbreviated(word) || syllables(word) === 0) continue;

        const key = accentKey(word);
        const stats = rates.get(key) ?? { accented: 0, plain: 0 };

        if (hasAccent(word)) {
            // Слово со сбитым знаком не свидетельствует ни за, ни против.
            if (!findAccentIssues(word).length) stats.accented++;
            else continue;
        } else {
            stats.plain++;
        }

        rates.set(key, stats);
    }
};

// Сколько раз слово должно встретиться размеченным, чтобы по нему судить.
export const MIN_EVIDENCE = 3;
export const EXPECTED_SHARE = 0.9;

export const isAccentExpected = (rates: AccentRates, key: string) => {
    const stats = rates.get(key);
    if (!stats || stats.accented < MIN_EVIDENCE) return false;
    return stats.accented / (stats.accented + stats.plain) >= EXPECTED_SHARE;
};

// Киноварь: от «{k|» до ближайшей закрывающей скобки. Внутри неё — уставные пометы,
// которые страница чтения печатает красным; в богослужебных книгах их не размечают
// (знак стоит у 39% слов против 98% снаружи), и ставить ударения туда нельзя.
export const rubricRanges = (content: string): [number, number][] => {
    const ranges: [number, number][] = [];
    const opener = /\{k\|/g;
    let match: RegExpExecArray | null;

    while ((match = opener.exec(content))) {
        const close = content.indexOf("}", match.index);
        ranges.push([match.index, close < 0 ? content.length : close]);
    }

    return ranges;
};

export const isInRubric = (ranges: [number, number][], at: number) =>
    ranges.some(([from, to]) => at >= from && at <= to);

// --- постановка знака --------------------------------------------------------

// Ставит знак после n-й гласной, сохраняя всё остальное на месте: буквы, ерок,
// титло, звательце. Уже стоящие знаки ударения убираются — либо их там не было,
// либо они стояли неверно, иначе бы мы сюда не попали.
export const placeAccent = (word: string, index: number, mark: string): string | null => {
    const chars = [...word].filter((ch) => !isAccent(ch));
    let vowels = -1;

    for (let i = 0; i < chars.length; i++) {
        if (!isVowel(chars[i]) || isCombining(chars[i])) continue;
        vowels++;
        if (vowels !== index) continue;

        // Знак идёт после буквы и всей приросшей к ней диакритики: в наборе
        // принято «а҆́» — сперва звательце, потом ударение.
        let at = i + 1;
        while (at < chars.length && isCombining(chars[at])) at++;
        chars.splice(at, 0, mark);
        return chars.join("");
    }

    return null;
};

export interface Lookup extends StressVariant {
    confidence: Confidence;
    rival: number;
}

export const lookup = (dictionary: AccentDictionary, key: string): Lookup | null => {
    const variants = dictionary.get(key);
    if (!variants?.length) return null;

    const [best] = variants;
    if (variants.length === 1) return { ...best, confidence: "sure", rival: 0 };

    const rival = variants[1].count;
    return {
        ...best,
        confidence: best.count >= DOMINANCE * rival ? "likely" : "unsure",
        rival,
    };
};

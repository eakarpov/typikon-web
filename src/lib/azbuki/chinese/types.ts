// Формы данных китайской азбуки, насколько их трогает страница.
//
// Движок (engine.js) перенесён из chinese-latin дословно и типов не несёт:
// он написан классическим скриптом. Здесь описано только то, что страница
// действительно читает, — остальные поля существуют, но нас не касаются.

/** Слог: фонологическая позиция 音韻地位 и её написание. */
export interface Syllable {
    l: string;   // написание нашей латиницей
    p: string;   // 音韻地位 целиком, «端一東平»
    b: string;   // транскрипция Бакстера
    I: string;   // 母 — инициаль
    h: string;   // 呼 — огублённость
    d: string;   // 等 — ряд
    c: string;   // 類 — 重紐
    R: string;   // 韻 — рифма
    t: string;   // 聲 — тон
    v: string;   // 清濁 — звонкость
    r: 0 | 1;    // несёт ли метку *-r-
    ty: number;  // тон кантонского по правилу
    tc: number;  // тон путунхуа по правилу
}

/** Чтение иероглифа, как его отдаёт core.readings. */
export interface Reading {
    syl: Syllable;
    gloss: string;
    primary: boolean;
    fanqie: string;
    from: string | null;   // знак, у которого чтение занято (вариантное начертание)
    artificial: boolean;   // написание назначено, а не унаследовано
}

export interface CharEntry {
    r?: unknown[][];                        // чтения в сыром виде, разбирает core.readings
    m?: Record<string, string[]>;           // современные чтения по разновидностям
    f?: number;                             // ранг по частотности
    d?: string;                             // английская глосса Unihan
}

/** Кусок слова в выводе: серым идут назначенные написания. */
export interface LatinChunk {
    text: string;
    artificial: boolean;
}

export interface WordPart {
    ch: string;
    syl: Syllable | null;
    fromDict: boolean;
    artificial: boolean;
    pinyin: string | null;
    ambiguous: boolean;
}

export interface Segment {
    type: "word" | "other";
    text: string;
    inDict: boolean;
    parts: WordPart[];
}

/** e — точных совпадений, s — только по сегментам (тон иной), t — всего */
export interface Accuracy { e: number; s: number; t: number }

export interface Reference {
    ipa: Record<string, string>;
    /** [название ряда, [[母, буква] | null, …]] — по одной ячейке на серию */
    initials: [string, ([string, string] | null)[]][];
    /** [ядро, с медиалью j, рифмы 開口, рифмы 合口/йотированные] */
    nuclei: [string, string, string, string][];
    /** буква → сколько слогов её содержат */
    letters: Record<string, number>;
    /** «coda_tone|yue» → [[ключ, значение, n, доля], …] */
    corr: Record<string, [string, string, number, number][]>;
    /** Точность вывода по выборкам — считается при сборке, а не на странице */
    derivation: { band: number; cmn: Accuracy; yue: Accuracy }[];
    /** Назначенные написания: у морфемы нет среднекитайского предка */
    artificial: { ch: string; latin: string; cmn: string; derived: string;
                  exact: boolean; kind: string }[];
    meta: Record<string, string>;
    counts: { syllables: number; characters: number; readings: number };
}

export interface Cognate {
    c: string;        // концепт
    n: number;        // сколько языков семьи в когнатном классе
    oc: string;       // древнекитайская реконструкция
    lat: string;      // написание нашей латиницей
    /** [подгруппа, язык, название языка, форма] */
    f: [string, string, string, string][];
}

export interface Sinitic {
    rows: (string | null)[][];
    /** [признак, идиом, ведро, n, всего] */
    stat: [string, string, string, number, number][];
    varieties: string[];
}

/** Движок: всё, что страница вызывает. */
export interface Engine {
    syllables: Syllable[];
    chars: Record<string, CharEntry>;
    variants?: Record<string, string[]>;
    reference?: Reference;
    words?: unknown;
    cognates?: Record<string, Cognate[]>;
    sinitic?: Sinitic;
    core: {
        lookup(ch: string): { char: string; entry: CharEntry; via: string | null } | null;
        readings(entry: CharEntry): Reading[];
        primaryLatin(entry: CharEntry): string | null;
        isArtificial(entry: CharEntry): boolean;
        homophones(latin: string, exclude: string | null): string[];
        derive(syl: Syllable): { putonghua?: string | null; gwongzau?: string | null };
        compareReading(derived: string, attested: string): "exact" | "segments" | "differs" | null;
        parse(latin: string): Record<string, string>;
        describe(parsed: Record<string, string>): string;
        segment(line: string): Segment[];
        wordToLatin(parts: WordPart[]): string;
        wordToLatinChunks(parts: WordPart[]): LatinChunk[];
        needsApostrophe(prev: string, next: string): boolean;
        isHan(ch: string): boolean;
        tokenize(s: string): { ch: string; han: boolean }[];
        modern(entry: CharEntry): { name: string; values: string[] }[];
        DERIVERS: Record<string, string>;
        TONE_CODA: Record<string, string>;
    };
}

/** Наборы данных по вкладкам: страница не тянет 6,8 МБ там, где нужно 0,5. */
export const DATASETS = {
    // справочнику словарь чтений не нужен: числа и списки посчитаны при сборке
    reference: ["reference", "syllables", "sinitic", "cognates"],
    character: ["syllables", "chars", "variants", "cognates"],
    text: ["syllables", "chars", "variants", "words"],
} as const;

export type TabId = keyof typeof DATASETS;

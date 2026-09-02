import { rulesDb } from "@/lib/rulesDb";

// Указатель зачинов — по первым словам песнопения.
//
// Стоит на таблице text_incipits корпуса typikon-rules: 226 832 строки,
// 182 650 различных зачинов на шести языках. Таблица наполняется сборкой
// (migrate_text_links.py) и служила там рабочим ключом отождествления; сюда она
// выведена как есть, ничего не пересчитывая.
//
// Чем этот раздел отличается от поиска по песнопениям (@/lib/chants). Там FTS5
// ищет слово ГДЕ УГОДНО в строке и ранжирует по bm25. Здесь ищется НАЧАЛО и
// только начало, потому что зачин — это адрес песнопения, а не его содержание:
// по зачину текст опознают, на зачин ссылаются, зачином он стоит в книге, когда
// печатается не полностью. Поэтому и запрос идёт не через FTS, а диапазоном по
// индексу (language, incipit) — см. prefixRange ниже.

/** Сколько слов берёт зачин. Столько же берёт сборка (INCIPIT_WORDS). */
export const INCIPIT_WORDS = 6;

// Порога длины запроса здесь нет, и это отличие от поиска по песнопениям.
// Там три буквы — необходимый предел: выдача вырождается в весь корпус, а
// ранжировать её нечем. Указатель же именно для того и открывают, чтобы листать
// с буквы: «в» — это 12 982 зачина, они разложены по страницам, и счёт по ним
// стоит 33 мс, потому что идёт по тому же индексу. Запретить одну букву значило
// бы отнять у указателя его собственный способ чтения.

/**
 * Языки корпуса в порядке убывания числа строк.
 *
 * Держим списком, а не запросом: он нужен КАЖДОМУ поиску без отбора по языку
 * (см. listIncipits — там по нему строится IN, чтобы индекс работал), и ходить
 * за ним в базу на каждый запрос незачем. Расходится со сборкой он молча, но
 * дёшево: язык здесь не появляется сам по себе, его заводят вместе с изданием.
 */
export const LANGUAGES = ["cu_gr", "ro", "grc", "en", "et", "ar"] as const;

/**
 * Нормализация запроса под ключ таблицы.
 *
 * ВАЖНО: она ПРОТИВОПОЛОЖНА той, что в @/lib/chants, и перепутать их нельзя.
 * Там normalizeChantQuery специально СОХРАНЯЕТ «й», потому что токенизатор FTS5
 * его не разбирает и «радуйся» в индексе лежит с «й». Здесь наоборот: сборка
 * строит ключ через NFD со снятием Mn, а NFD раскладывает «й» на «и» + краткое,
 * и краткое снимается вместе с ударениями. Зачинов с «й» в таблице РОВНО НОЛЬ
 * (сверено), как и с «ё». Возьми мы normalizeChantQuery — «Радуйся» не нашло бы
 * ничего и никогда.
 *
 * Повторяем migrate_text_links.incipit() шаг в шаг: NFD → снять Mn → lower →
 * всё, кроме букв, цифр и подчёркивания, в пробел → схлопнуть пробелы.
 *
 * Единственная тонкость перевода с Python: там `[^\w\s]` оставляет кириллицу и
 * греческий, потому что `\w` в Python юникодный, а в JavaScript он ASCII — та же
 * регулярка выкосила бы весь текст до пустой строки. Отсюда \p{L}\p{N} и флаг u.
 */
export const normalizeIncipitQuery = (query: string): string =>
    query
        .normalize("NFD")
        .replace(/\p{Mn}/gu, "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}_\s]/gu, " ")
        .split(/\s+/)
        .filter(Boolean)
        // Ключ длиннее шести слов не бывает, и седьмое слово не сузило бы
        // выдачу, а обнулило: под такой префикс не подходит ни один зачин.
        .slice(0, INCIPIT_WORDS)
        .join(" ");

/**
 * Границы диапазона для поиска по началу.
 *
 * Именно диапазон, а не LIKE 'префикс%': с LIKE план вырождается в скан
 * (SEARCH ... USING COVERING INDEX (language=?) — сто двадцать тысяч строк на
 * славянском), а с диапазоном SQLite берёт обе колонки индекса разом
 * (language=? AND incipit>? AND incipit<?) и укладывается в единицы миллисекунд.
 *
 * Верхняя граница — приписанный к префиксу наибольший кодовый знак: любая
 * строка, начинающаяся с префикса, меньше его.
 */
const UPPER_BOUND = String.fromCodePoint(0x10ffff);
const prefixRange = (prefix: string): [string, string] => [prefix, prefix + UPPER_BOUND];

export interface IncipitFilters {
    language?: string | null;
    /** Род строки: stichera, irmos, troparion… Им отсеивают припевы и пометы. */
    unit?: string | null;
    /** Владелец строки в корпусе: book | canon | akathist | prayer. */
    source?: string | null;
}

/** По алфавиту — как положено указателю; по числу вхождений — для сличения. */
export type IncipitSort = "alpha" | "uses";

export interface IncipitRow {
    incipit: string;
    language: string;
    /** Сколько раз этот зачин встречается в корпусе. Чаще всего — один. */
    uses: number;
    /** Представительное вхождение: на него ведёт ссылка, из него берётся текст. */
    sampleId: number;
    /** Как напечатано, с ударениями. */
    text: string;
    unit: string;
    book: string | null;
    memory: string | null;
    akathist: string | null;
}

export interface IncipitSearchResult {
    items: IncipitRow[];
    total: number;
}

// Владелец строки -> условие. Таблицей, а не склейкой: имя приходит из адреса
// страницы, и подставлять оттуда что-либо в SQL нельзя (тот же приём и та же
// причина, что в @/lib/chants).
const SOURCE_CONDITION: Record<string, string> = {
    book: "ci.group_id IS NOT NULL",
    canon: "ci.canon_id IS NOT NULL",
    akathist: "ci.akathist_id IS NOT NULL",
    prayer: "ci.prayer_id IS NOT NULL",
};

/**
 * Страница указателя.
 *
 * Отбор и группировка идут по одному индексу, а соединения ради показа —
 * только для отрезанной страницы: тот же приём, что в searchChants, и по той же
 * причине. Соединение с content_items в первой части появляется лишь тогда,
 * когда по нему действительно фильтруют, — иначе покрывающий индекс перестаёт
 * быть покрывающим.
 */
export const listIncipits = (
    query: string,
    filters: IncipitFilters = {},
    sort: IncipitSort = "alpha",
    limit = 25,
    offset = 0,
): IncipitSearchResult | null => {
    const db = rulesDb();
    if (!db) return null;

    const prefix = normalizeIncipitQuery(query);
    const [low, high] = prefixRange(prefix);

    // Язык — первая колонка индекса, и без него диапазон по второй не берётся.
    // Когда язык не выбран, перечисляем все: SQLite делает по одному поиску на
    // значение IN, и шесть поисков по индексу дешевле одного скана.
    const languages = filters.language ? [filters.language] : [...LANGUAGES];
    const langList = languages.map(() => "?").join(", ");

    const extra: { sql: string; value?: string }[] = [];
    const source = filters.source && SOURCE_CONDITION[filters.source];
    if (source) extra.push({ sql: source });
    if (filters.unit) extra.push({ sql: "ci.content_unit = ?", value: filters.unit });

    const needsItems = extra.length > 0;
    const where = extra.map(c => c.sql).join(" AND ");
    const extraValues = extra.flatMap(c => (c.value === undefined ? [] : [c.value]));

    const from = `
        FROM text_incipits ti
        ${needsItems ? "JOIN content_items ci ON ci.item_id = ti.item_id" : ""}
        WHERE ti.language IN (${langList})
          AND ti.incipit >= ? AND ti.incipit < ?
          ${where ? `AND ${where}` : ""}
        GROUP BY ti.language, ti.incipit`;

    const values = [...languages, low, high, ...extraValues];

    const total = db.prepare(
        `SELECT count(*) AS n FROM (SELECT 1 ${from})`,
    ).get(...values) as { n: number };

    const order = sort === "uses" ? "uses DESC, ti.incipit" : "ti.incipit, uses DESC";

    const rows = db.prepare(`
        WITH keys AS (
            SELECT ti.language AS language, ti.incipit AS incipit,
                   count(*) AS uses, min(ti.item_id) AS sample_id
            ${from}
            ORDER BY ${order}
            LIMIT ? OFFSET ?
        )
        SELECT k.language, k.incipit, k.uses, k.sample_id,
               COALESCE(ci.text, ft.text, o.text) AS text,
               ci.content_unit,
               m.book, m.label AS memory,
               a.title AS akathist_title
        FROM keys k
        JOIN content_items ci ON ci.item_id = k.sample_id
        LEFT JOIN groups g ON g.group_id = ci.group_id
        LEFT JOIN canons c ON c.canon_id = ci.canon_id
        LEFT JOIN akathists a ON a.akathist_id = ci.akathist_id
        LEFT JOIN fixed_texts ft ON ft.text_id = ci.ref_text_id
        LEFT JOIN content_items o ON o.item_id = ci.ref_item_id
        LEFT JOIN memories m ON m.memory_id = COALESCE(g.memory_id, c.memory_id,
                                                       a.memory_id)
        ORDER BY ${order.replace(/ti\./g, "k.")}
    `).all(...values, limit, offset) as any[];

    return {
        total: total?.n ?? 0,
        items: rows.map(r => ({
            incipit: r.incipit,
            language: r.language,
            uses: r.uses,
            sampleId: r.sample_id,
            text: r.text ?? "",
            unit: r.content_unit,
            book: r.book ?? null,
            memory: r.memory ?? null,
            akathist: r.akathist_title ?? null,
        })),
    };
};

// Держим посчитанное в памяти процесса: файл корпуса подменяется только вместе
// с перезапуском сайта (rules-db-release.sh делает mv и рестартует службу), так
// что устареть этот кэш не может.
const alphabetCache = new Map<string, string[]>();

/**
 * Буквы, с которых начинаются зачины. Чем открывается пустая страница указателя.
 *
 * У поиска по песнопениям пустой странице показывать нечего, и он честно
 * говорит «наберите запрос». У указателя вход есть всегда: буквенный перечень —
 * это то, чем указатель и является, когда его открывают, а не спрашивают.
 *
 * Идём по индексу прыжками, а не считаем GROUP BY substr(). Разница не
 * косметическая: группировка обязана прочитать все 122 тысячи ключей языка, и
 * на холодном кэше это заняло 7,5 секунды прямо на отрисовке страницы. Здесь
 * каждый шаг — один поиск по индексу «первый зачин после буквы X», шагов
 * столько же, сколько букв, и всё вместе укладывается в 13 мс.
 *
 * Чисел при буквах намеренно нет: сколько зачинов на букву — это снова счёт по
 * всем ключам, то есть ровно тот скан, ради ухода от которого всё и написано.
 * Сколько нашлось, читатель увидит, нажав букву.
 */
export const alphabetOf = (language: string): string[] | null => {
    const db = rulesDb();
    if (!db) return null;

    const cached = alphabetCache.get(language);
    if (cached) return cached;

    const rows = db.prepare(`
        WITH RECURSIVE letters(ch) AS (
            SELECT (SELECT substr(incipit, 1, 1) FROM text_incipits
                     WHERE language = ? ORDER BY incipit LIMIT 1)
            UNION ALL
            SELECT (SELECT substr(incipit, 1, 1) FROM text_incipits
                     WHERE language = ? AND incipit > l.ch || ?
                     ORDER BY incipit LIMIT 1)
            FROM letters l WHERE l.ch IS NOT NULL
        )
        SELECT ch FROM letters WHERE ch IS NOT NULL
    `).all(language, language, UPPER_BOUND) as any[];

    const letters = rows
        .map(r => r.ch as string)
        // Цифры в начале зачина — след разбора («1 ангелов царице», 2 087
        // записей), а не буква указателя: искать по ним никто не станет.
        .filter(ch => /\p{L}/u.test(ch));

    alphabetCache.set(language, byScript(letters));
    return alphabetCache.get(language)!;
};

// Письменности в порядке появления в корпусе. Буква определяется первой, какая
// подошла; чего в списке нет, идёт последним.
const SCRIPTS = [
    /\p{Script=Cyrillic}/u,
    /\p{Script=Greek}/u,
    /\p{Script=Latin}/u,
    /\p{Script=Arabic}/u,
];

const scriptOf = (ch: string): number => {
    const found = SCRIPTS.findIndex(re => re.test(ch));
    return found === -1 ? SCRIPTS.length : found;
};

/**
 * Раскладываем буквы по письменностям, крупные вперёд.
 *
 * Простой порядок по коду знака выглядит сломанным: у славянского указателя
 * латиница и греческий стоят в юникоде ПЕРЕД кириллицей, и перечень открывался
 * семью латинскими буквами и двумя десятками греческих, за которыми лишь потом
 * шло «а б в г». Между тем латинские начала — это семь случайных зачинов с
 * следами разбора, а греческие — вкрапления в славянские ключи.
 *
 * Выкинуть их было бы неправдой: они в корпусе есть, и по ним что-то найдётся.
 * Поэтому не прячем, а ставим по величине: письменность, давшая больше букв,
 * идёт первой. Для славянского указателя это кириллица, для греческого —
 * греческий алфавит, и правило работает само, без списка языков в коде.
 */
const byScript = (letters: string[]): string[] => {
    const groups = new Map<number, string[]>();
    for (const ch of letters) {
        const key = scriptOf(ch);
        (groups.get(key) ?? groups.set(key, []).get(key)!).push(ch);
    }
    return [...groups.values()]
        .sort((a, b) => b.length - a.length)
        .flat();
};

export interface IncipitFacets {
    languages: { code: string; count: number }[];
    units: string[];
    sources: string[];
}

// Списки фасетов тоже неизменны между выкладками — считаем их один раз.
let facetsCache: IncipitFacets | undefined;

/**
 * Чем можно сузить указатель. Берём из корпуса, а не списком в коде: роды
 * песнопений прибавляются по мере разбора, и захардкоженный перечень разошёлся
 * бы с содержимым молча.
 *
 * Числа при языках — это СТРОКИ, а не различные зачины. Различных считать не
 * стали намеренно: `count(DISTINCT incipit)` вшестеро дороже и читает те же все
 * ключи (0,69 с против 0,11 с на прогретом кэше), а нужны эти числа только
 * затем, чтобы расставить языки по величине в выпадающем списке.
 *
 * Роды строк берём из content_items без соединения с указателем. С соединением
 * тот же список стоил шесть секунд: у 226 тысяч зачинов не бывает рода, какого
 * нет у строк корпуса, — соединение ничего не уточняло и просто читало всё.
 */
export const incipitFacets = (): IncipitFacets | null => {
    const db = rulesDb();
    if (!db) return null;
    if (facetsCache) return facetsCache;

    facetsCache = {
        languages: (db.prepare(`
            SELECT language, count(*) AS n
            FROM text_incipits GROUP BY language ORDER BY n DESC
        `).all() as any[]).map(r => ({ code: r.language as string, count: r.n as number })),
        units: (db.prepare(
            "SELECT DISTINCT content_unit AS unit FROM content_items ORDER BY unit",
        ).all() as any[]).map(r => r.unit as string),
        sources: ["book", "canon", "akathist", "prayer"],
    };
    return facetsCache;
};

export interface Witness {
    id: number;
    language: string;
    unit: string;
    ode: number | null;
    stanza: number | null;
    stanzaKind: string | null;
    marker: string | null;
    placement: string | null;
    tone: number | null;
    service: string | null;
    position: string | null;
    memoryId: string | null;
    memory: string | null;
    book: string | null;
    month: number | null;
    day: number | null;
    paschaOffset: number | null;
    weekday: string | null;
    memoryTone: number | null;
    akathist: string | null;
    canonId: string | null;
    sourceBook: string | null;
}

/** Как связан свидетель на другом языке — и насколько этому можно верить. */
export interface Translation {
    id: number;
    language: string;
    text: string;
    incipit: string | null;
    method: string;
    confidence: string;
    evidence: string | null;
}

export interface IncipitDetail {
    incipit: string;
    language: string;
    uses: number;
    /** Текст представительного вхождения, как напечатано. */
    text: string;
    /** Текста своего нет — взят по ссылке (Ирмологий или соседний канон). */
    borrowed: boolean;
    witnesses: Witness[];
    /** Перевод, заявленный издателем: у AGES слои стоят на одном ключе. */
    declared: Translation[];
    /** Догадка по совпавшему месту службы. Бывает ложной — см. ниже. */
    supposed: Translation[];
}

const witnessSql = `
    SELECT ci.item_id, ci.language, ci.content_unit, ci.ode, ci.stanza,
           ci.stanza_kind, ci.marker, ci.placement, ci.canon_id,
           ci.text, ft.text AS from_dictionary, o.text AS from_item,
           COALESCE(g.tone, c.tone) AS tone,
           COALESCE(g.service, c.service) AS service,
           p.label AS position_label,
           m.memory_id, m.label AS memory, m.book, m.month, m.day,
           m.pascha_offset, m.weekday, m.tone AS memory_tone,
           a.title AS akathist_title,
           COALESCE(g.source_book, a.source_book) AS source_book
    FROM content_items ci
    LEFT JOIN groups g ON g.group_id = ci.group_id
    LEFT JOIN canons c ON c.canon_id = ci.canon_id
    LEFT JOIN akathists a ON a.akathist_id = ci.akathist_id
    LEFT JOIN fixed_texts ft ON ft.text_id = ci.ref_text_id
    LEFT JOIN content_items o ON o.item_id = ci.ref_item_id
    LEFT JOIN memories m ON m.memory_id = COALESCE(g.memory_id, c.memory_id, a.memory_id)
    LEFT JOIN positions p ON p.position_id = COALESCE(g.position_id, c.position_id)`;

const witnessOf = (r: any): Witness => ({
    id: r.item_id,
    language: r.language ?? "cu_gr",
    unit: r.content_unit,
    ode: r.ode ?? null,
    stanza: r.stanza ?? null,
    stanzaKind: r.stanza_kind ?? null,
    marker: r.marker ?? null,
    placement: r.placement ?? null,
    tone: r.tone ?? null,
    service: r.service ?? null,
    position: r.position_label ?? null,
    memoryId: r.memory_id ?? null,
    memory: r.memory ?? null,
    book: r.book ?? null,
    month: r.month ?? null,
    day: r.day ?? null,
    paschaOffset: r.pascha_offset ?? null,
    weekday: r.weekday ?? null,
    memoryTone: r.memory_tone ?? null,
    akathist: r.akathist_title ?? null,
    canonId: r.canon_id ?? null,
    sourceBook: r.source_book ?? null,
});

/**
 * Один зачин: где он встречается и что ему соответствует на других языках.
 *
 * Соответствие ищется ДВУМЯ ПРЫЖКАМИ, и это не усложнение ради полноты.
 * Сначала внутри своего языка собираются перепечатки (same-text, 44 182 связи),
 * потом от каждой из них — переводы. Иначе перевод, заведённый к другому
 * вхождению того же текста, потерялся бы: связи заводятся между строками, а не
 * между зачинами.
 *
 * Разделение declared/supposed — главное в этой выдаче.
 *
 * `translation/edition/certain` (24 130 пар) утверждаем не мы: у AGES греческий
 * и английский слои стоят на ОДНОМ ключе издателя, и что английская строка есть
 * перевод греческой, заявлено книгой.
 *
 * `translation/structure/candidate` (16 641 пара) — догадка по совпавшему месту
 * службы, и она бывает ложной. Живой пример: у места
 * menaion/m01-02/vespers/tropar/svyatomu#1 строк поровну и глас совпал, поэтому
 * связаны «Правило веры и образ кротости» (свт. Сильвестру) и «Ἑτοιμάζου
 * Ζαβουλών» (предпразднство Богоявления) — РАЗНЫЕ песнопения. Показывать их
 * вперемешку с заявленным значило бы врать читателю.
 */
export const getIncipit = (language: string, incipit: string): IncipitDetail | null => {
    const db = rulesDb();
    if (!db) return null;

    const seeds = (db.prepare(
        "SELECT item_id FROM text_incipits WHERE language = ? AND incipit = ? ORDER BY item_id",
    ).all(language, incipit) as any[]).map(r => r.item_id as number);
    if (seeds.length === 0) return null;

    const list = seeds.map(() => "?").join(", ");
    const witnesses = (db.prepare(
        `${witnessSql} WHERE ci.item_id IN (${list})
         ORDER BY m.book, m.month, m.day, ci.item_id`,
    ).all(...seeds) as any[]);

    // Вхождения показываем в порядке служебного адреса, а представительное
    // берём с наименьшим item_id — тем же, каким его берёт список (min(item_id)).
    // Иначе на карточке и на странице стояли бы разные тексты одного зачина:
    // за первыми шестью словами вхождения расходятся.
    const sample = witnesses.find(w => w.item_id === seeds[0]) ?? witnesses[0] ?? {};
    const resolved = sample.from_dictionary ?? sample.from_item ?? null;

    const links = db.prepare(`
        WITH seed(item_id) AS (VALUES ${seeds.map(() => "(?)").join(", ")}),
        same AS (
            SELECT item_id FROM seed
            UNION SELECT tl.other_item_id FROM text_links tl
                   JOIN seed s ON s.item_id = tl.item_id  WHERE tl.kind = 'same-text'
            UNION SELECT tl.item_id       FROM text_links tl
                   JOIN seed s ON s.item_id = tl.other_item_id WHERE tl.kind = 'same-text'
        ),
        across AS (
            SELECT tl.other_item_id AS id, tl.method, tl.confidence, tl.evidence
              FROM text_links tl JOIN same s ON s.item_id = tl.item_id
             WHERE tl.kind = 'translation'
            UNION
            SELECT tl.item_id AS id, tl.method, tl.confidence, tl.evidence
              FROM text_links tl JOIN same s ON s.item_id = tl.other_item_id
             WHERE tl.kind = 'translation'
        )
        SELECT a.method, a.confidence, a.evidence,
               ci.item_id, ci.language, COALESCE(ci.text, '') AS text, ti.incipit
        FROM across a
        JOIN content_items ci ON ci.item_id = a.id
        LEFT JOIN text_incipits ti ON ti.item_id = ci.item_id
        ORDER BY ci.language, ci.item_id
    `).all(...seeds) as any[];

    const translations = links.map(r => ({
        id: r.item_id,
        language: r.language ?? "",
        text: r.text ?? "",
        incipit: r.incipit ?? null,
        method: r.method,
        confidence: r.confidence,
        evidence: r.evidence ?? null,
    }));

    return {
        incipit,
        language,
        uses: seeds.length,
        text: sample.text ?? resolved ?? "",
        borrowed: sample.text === null && resolved !== null,
        witnesses: witnesses.map(witnessOf),
        declared: translations.filter(t => t.confidence === "certain"),
        supposed: translations.filter(t => t.confidence !== "certain"),
    };
};

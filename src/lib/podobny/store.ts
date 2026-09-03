import { rulesDb } from "@/lib/rulesDb";
import { conditionsFor, splitSnippet, type ChantFilters, type ChantHit } from "@/lib/chants";
import { normalizeIncipitQuery } from "@/lib/incipits";
import { plural } from "@/utils/plural";
import { podobenUnits, type PodobenRow, type PodobenUnit } from "@/lib/podobny/core";

// Выборки подобнов из корпуса.
//
// Указатель считается ОДНИМ запросом и живёт в памяти процесса — тем же
// приёмом, что алфавит зачинов (@/lib/incipits): файл корпуса подменяется
// только вместе с перезапуском службы (rules-db-release.sh делает mv и
// рестарт), так что устареть этот кэш не может. Запрос обходит 42 513 групп,
// индекса по `podoben` нет и не нужно: единожды на процесс это десятки
// миллисекунд.
//
// Класть указатель в Монгу, как свод цитируемости, было бы церемонией:
// там пересчёт стоит секунды, здесь — миллисекунды, и лишнее хранилище
// умеет только расходиться с корпусом.

const UPPER_BOUND = String.fromCodePoint(0x10ffff);

let cache: PodobenUnit[] | undefined;

const load = (): PodobenUnit[] | null => {
    const db = rulesDb();
    if (!db) return null;

    // Два счёта, а не один, и они не взаимозаменяемы: `groups` — сколько раз
    // книга подписала подобном место, `items` — сколько стихир на него
    // поётся. Различаются они втрое, и страницы ведут счёт стихирами.
    const rows = db.prepare(`
        SELECT g.language, g.podoben, g.podoben_key AS podobenKey, g.tone,
               count(DISTINCT g.group_id) AS groups,
               count(ci.item_id) AS items
        FROM groups g
        LEFT JOIN content_items ci ON ci.group_id = g.group_id
        WHERE g.podoben IS NOT NULL AND length(g.podoben) > 0
        GROUP BY g.language, g.podoben, g.podoben_key, g.tone
    `).all() as PodobenRow[];

    return podobenUnits(rows);
};

/** Указатель подобнов. null — корпуса нет вовсе. */
export const podobnyIndex = (): PodobenUnit[] | null => {
    if (process.env.NODE_ENV === "development") return load();
    if (cache === undefined) {
        const loaded = load();
        if (!loaded) return null;
        cache = loaded;
    }
    return cache;
};

/**
 * Подобен по адресу.
 *
 * Адрес выводится из имени, а имя может смениться пересборкой корпуса.
 * Поэтому мимо совпадения по нынешнему слагу спрашиваем ещё и по ключу AGES:
 * старая ссылка тогда доходит до цели, а не в «не найдено».
 */
export const getPodoben = (slug: string): PodobenUnit | null => {
    const index = podobnyIndex();
    if (!index) return null;
    return index.find((unit) => unit.slug === slug)
        ?? index.find((unit) => unit.agesKey && unit.agesKey.split(".").pop()!.toLowerCase() === slug.replace(/-/g, ""))
        ?? null;
};

/**
 * Чем отбираются строки единицы: ключ издания и пары «язык + написание».
 *
 * Пары, а не голый список написаний, и без пометок издания. Первая попытка
 * искала `g.podoben IN (…)` по одним строкам, и «Доме Евфрафов» собрал 1 424
 * стихиры вместо 1 147: в список написаний попало «Αὐτόμελον», а им помечены
 * группы полусотни ДРУГИХ подобнов. Пометка — не имя, и отбирать по ней нельзя;
 * строки, где она стоит, находятся по ключу.
 */
const selectorOf = (unit: PodobenUnit) => {
    const pairs = unit.spellings.filter((s) => !s.artefact);
    const sql = [
        ...(unit.agesKey ? ["g.podoben_key = ?"] : []),
        ...pairs.map(() => "(g.language = ? AND g.podoben = ?)"),
    ].join(" OR ");
    const values = [
        ...(unit.agesKey ? [unit.agesKey] : []),
        ...pairs.flatMap((s) => [s.language, s.printed]),
    ];
    return { sql: sql || "0", values };
};

/**
 * Стихиры, которые поются этим подобном.
 *
 * Тот же приём, что в поиске по песнопениям и в отзвуках: страницу отбираем
 * сначала, join'ы вешаем потом — иначе выборка тянет всё, что нашла, а не
 * двадцать пять строк, которые покажет.
 *
 * Единицу в SQL не выразить (она — результат нормализации), поэтому в запрос
 * едут ключ и список написаний. Всё — плейсхолдерами: имя приходит из адреса
 * страницы, и подставлять его в SQL нельзя (см. аудит в ROADMAP).
 */
export const podobenStichera = (
    unit: PodobenUnit,
    filters: ChantFilters = {},
    limit = 25,
    offset = 0,
): { items: ChantHit[]; total: number } | null => {
    const db = rulesDb();
    if (!db) return null;

    const selector = selectorOf(unit);
    const conditions = conditionsFor(filters);
    const where = conditions.map((c) => c.sql).join(" AND ");
    const values = [
        ...selector.values,
        ...conditions.flatMap((c) => (c.value === undefined ? [] : [c.value])),
    ];

    const from = `
        FROM content_items ci
        JOIN groups g ON g.group_id = ci.group_id
        LEFT JOIN memories m ON m.memory_id = g.memory_id
        LEFT JOIN memory_signs s ON s.memory_id = m.memory_id
        WHERE (${selector.sql})
          ${where ? `AND ${where}` : ""}`;

    const total = db.prepare(`SELECT count(*) AS n ${from}`).get(...values) as { n: number };

    const rows = db.prepare(`
        WITH hits AS (
            SELECT ci.item_id AS item_id
            ${from}
            ORDER BY m.book, m.month, m.day, ci.item_id
            LIMIT ? OFFSET ?
        )
        SELECT h.item_id, ci.text, ci.content_unit, ci.ode, ci.marker, ci.placement,
               m.memory_id, m.label AS memory_label, m.book, m.month, m.day,
               g.service AS service, g.tone AS tone,
               p.label AS position_label,
               s.default_sign AS sign,
               ci.stanza, ci.stanza_kind, ci.language, g.source_book
        FROM hits h
        JOIN content_items ci ON ci.item_id = h.item_id
        LEFT JOIN groups g ON g.group_id = ci.group_id
        LEFT JOIN memories m ON m.memory_id = g.memory_id
        LEFT JOIN positions p ON p.position_id = g.position_id
        LEFT JOIN memory_signs s ON s.memory_id = m.memory_id
        ORDER BY m.book, m.month, m.day, ci.item_id
    `).all(...values, limit, offset) as any[];

    return {
        total: total?.n ?? 0,
        items: rows.map((r) => ({
            id: r.item_id,
            // Запроса здесь нет, подсвечивать нечего: показываем начало строки
            // целым куском. Форма та же, что у выдачи поиска, — иначе
            // ChantCard пришлось бы учить второму виду фрагмента.
            snippet: splitSnippet(String(r.text ?? "").replace(/\//g, " ").slice(0, 160)),
            unit: r.content_unit,
            ode: r.ode ?? null,
            marker: r.marker ?? null,
            placement: r.placement ?? null,
            memoryId: r.memory_id ?? null,
            memory: r.memory_label ?? null,
            book: r.book ?? null,
            month: r.month ?? null,
            day: r.day ?? null,
            service: r.service ?? null,
            position: r.position_label ?? null,
            tone: r.tone ?? null,
            sign: r.sign ?? null,
            akathist: null,
            stanza: r.stanza ?? null,
            stanzaKind: r.stanza_kind ?? null,
            language: r.language ?? "cu_gr",
            sourceBook: r.source_book ?? null,
        })),
    };
};

/** Строка корпуса, начинающаяся теми же словами, что имя подобна. */
export interface SelfSimilar {
    itemId: number;
    language: string;
    incipit: string;
    /** Сколько строк корпуса начинается этим же зачином. */
    uses: number;
    text: string;
    tone: number | null;
    /** Подобен САМОЙ этой строки: у образца его нет. */
    podoben: string | null;
    book: string | null;
    memory: string | null;
    /** Чем эта строка похожа на образец — подпись для читателя. */
    why: string[];
}

/**
 * Самоподобен через указатель зачинов.
 *
 * Имя подобна — это зачин образцовой стихиры («До́ме Евфра́фов» — первые слова
 * стихиры на стиховне 20 декабря), а зачины у нас с 2026-09-02 лежат таблицей
 * с индексом. Значит образец ищется префиксом, и ничего собирать не надо.
 *
 * НАЙДЕННОЕ — НЕ УТВЕРЖДЕНИЕ. Корпус самоподобен как таковой не помечает
 * (пометка «Αὐτόμελον» у греков стоит не на образце, см. core.ts), а теми же
 * словами начинаются и подражания: под «доме евфрафов» лежат и образец, и три
 * стихиры, написанные на него. Строгий отбор — «у группы нет своего подобна и
 * глас тот же» — пробовали: он теряет «До́ме Евфра́фов» вовсе и даёт
 * единственного кандидата лишь в 35 случаях из 120. Поэтому не отбираем, а
 * показываем с уликами, и называем это «начинается так же».
 */
export const selfSimilar = (unit: PodobenUnit, limit = 4): SelfSimilar[] => {
    const db = rulesDb();
    if (!db) return [];

    const out: SelfSimilar[] = [];

    for (const name of unit.names) {
        const prefix = normalizeIncipitQuery(name.printed);
        if (!prefix) continue;

        const rows = db.prepare(`
            SELECT ti.item_id, ti.language, ti.incipit,
                   count(*) OVER (PARTITION BY ti.incipit) AS uses,
                   ci.text, g.tone, g.podoben, m.book, m.label AS memory
            FROM text_incipits ti
            JOIN content_items ci ON ci.item_id = ti.item_id
            LEFT JOIN groups g ON g.group_id = ci.group_id
            LEFT JOIN memories m ON m.memory_id = g.memory_id
            WHERE ti.language = ? AND ti.incipit >= ? AND ti.incipit < ?
            ORDER BY uses DESC, ti.item_id
            LIMIT ?
        `).all(name.language, prefix, prefix + UPPER_BOUND, limit * 4) as any[];

        // По строке на зачин, а не на строку корпуса: один и тот же образец
        // перепечатан под несколькими памятями, и четыре одинаковых пункта
        // подряд читались бы как четыре разных кандидата.
        const seen = new Set<string>();

        for (const row of rows) {
            if (seen.has(row.incipit)) continue;
            seen.add(row.incipit);

            const own = row.podoben ? String(row.podoben) : null;
            const why: string[] = [];
            if (!own) why.push("у самой строки подобна нет");
            else why.push(`сама поётся подобном «${own}»`);
            if (row.tone === unit.tone) why.push("тот же глас");
            else if (row.tone) why.push(`глас ${row.tone}, а не ${unit.tone ?? "—"}`);
            if (row.uses > 1) why.push(`${row.uses} ${plural(row.uses, "перепечатка", "перепечатки", "перепечаток")}`);

            out.push({
                itemId: row.item_id,
                language: row.language,
                incipit: row.incipit,
                uses: row.uses,
                text: String(row.text ?? ""),
                tone: row.tone ?? null,
                podoben: own,
                book: row.book ?? null,
                memory: row.memory ?? null,
                why,
            });
        }
    }

    return out;
};

/** Чем можно сузить список стихир ЭТОГО подобна. */
export interface PodobenFacets {
    books: string[];
    months: number[];
    units: string[];
    languages: string[];
}

export const podobenFacets = (unit: PodobenUnit): PodobenFacets | null => {
    const db = rulesDb();
    if (!db) return null;

    const selector = selectorOf(unit);
    const values = selector.values;

    const from = `
        FROM content_items ci
        JOIN groups g ON g.group_id = ci.group_id
        LEFT JOIN memories m ON m.memory_id = g.memory_id
        WHERE (${selector.sql})`;

    const column = <T>(field: string): T[] =>
        (db.prepare(`SELECT DISTINCT ${field} AS v ${from} AND ${field} IS NOT NULL ORDER BY v`)
            .all(...values) as any[]).map((r) => r.v as T);

    return {
        books: column<string>("m.book"),
        months: column<number>("m.month"),
        units: column<string>("ci.content_unit"),
        languages: column<string>("ci.language"),
    };
};

/**
 * Адрес страницы подобна по тому, как он напечатан в этой строке.
 *
 * Нужен странице песнопения: подпись «подобен „До́ме Евфра́фов“» — это готовый
 * вход в указатель, и оставлять её мёртвым текстом жаль. Спрашивается по паре
 * «язык + написание», потому что одно и то же написание в разных языках может
 * принадлежать разным единицам.
 */
export const podobenSlugOf = (language: string, printed: string | null | undefined): string | null => {
    if (!printed) return null;
    const index = podobnyIndex();
    if (!index) return null;
    const unit = index.find((u) =>
        u.spellings.some((s) => s.language === language && s.printed === printed));
    return unit?.slug ?? null;
};

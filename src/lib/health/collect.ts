import clientPromise from "@/lib/mongodb";
import { rulesDb } from "@/lib/rulesDb";
import { podobnyIndex } from "@/lib/podobny/store";
import { tuneLibrary } from "@/lib/tunes/registry";
import { citationBooks, citationSummary, corpusStamp, stampMatches } from "@/lib/otzvuki/store";
import { resolveTune } from "@/lib/tunes/resolve";
import { ACCENTS_DB } from "@/lib/accents/store";
import { plural } from "@/utils/plural";
import { bookLanguageLabel } from "@/utils/bookLanguages";
import type { HealthReport, Metric, MetricGroup } from "@/lib/health/core";

// Сбор недостач. Каждая цифра снимается запросом, а не берётся из записи о
// прошлом прогоне: панель, которая пересказывает ROADMAP, врала бы ровно там,
// где нужнее всего правда.
//
// СЧИТАЕТСЯ ЖИВЬЁМ, И ЭТО ОСОЗНАННО. Полный сбор — около двух секунд: скан
// по 230 тысячам строк корпуса ради разметки колен и полусекундный join ради
// языков. Для раздела сайта это было бы непозволительно, для админской
// страницы, которую открывают, когда ищут работу, — нет. Кэшировать её значило
// бы показывать вчерашние дыры тому, кто вчера же их и закрывал.
//
// ИСТОЧНИК МОЖЕТ БЫТЬ НЕДОСТУПЕН, и это не ноль. Корпуса на сервере может не
// быть вовсе (`rulesDb()` вернёт null), свод цитируемости мог быть ни разу не
// посчитан. Ноль в такой строке означал бы «всё сделано» — прямо обратное
// правде, поэтому группа честно говорит, что спросить было не у кого.

const num = (value: unknown): number => (typeof value === "number" ? value : 0);

/** Числа в подписях — с разрядами и в нужном падеже: подписи читают, а не считают. */
const n = (value: number) => value.toLocaleString("ru-RU");

/** Языки корпуса, у которых разметка цитат Писания есть, и все прочие. */
const citationLanguages = (db: NonNullable<ReturnType<typeof rulesDb>>) => {
    const all = (db.prepare("SELECT DISTINCT language FROM groups WHERE language IS NOT NULL")
        .all() as Array<{ language: string }>).map((r) => r.language);

    // Строка корпуса принадлежит либо книге (groups), либо канону; язык лежит
    // у них, а не у самой строки, поэтому COALESCE. Акафисты и молитвы дают
    // «без книги» — их сюда не считаем, языка у них в этой связке нет.
    const cited = (db.prepare(`
        SELECT COALESCE(g.language, c.language) AS lang
        FROM scripture_citations x
        JOIN content_items ci ON ci.item_id = x.item_id
        LEFT JOIN groups g ON g.group_id = ci.group_id
        LEFT JOIN canons c ON c.canon_id = ci.canon_id
        WHERE COALESCE(g.language, c.language) IS NOT NULL
        GROUP BY lang
    `).all() as Array<{ lang: string }>).map((r) => r.lang);

    return { all, cited: new Set(cited) };
};

const corpusGroup = (): MetricGroup => {
    const db = rulesDb();
    if (!db) {
        return {
            id: "corpus",
            title: "Разбор книг",
            source: "корпус typikon-rules (SQLite)",
            metrics: [],
            unavailable: "Корпус на этом сервере не выложен — спросить не у кого.",
        };
    }

    const one = (sql: string) => db.prepare(sql).get() as { gap: number; total: number };

    const canons = one(`
        SELECT sum(role IS NULL OR role = '') AS gap, count(*) AS total FROM canons`);
    const tones = one(`
        SELECT sum(tone IS NULL) AS gap, count(*) AS total
        FROM groups WHERE podoben IS NOT NULL AND podoben <> ''`);
    const irmos = one(`
        SELECT sum(ref_text_id IS NULL) AS gap, count(*) AS total
        FROM content_items WHERE ref_project = 'irmologion'`);
    const colons = one(`
        SELECT sum(text NOT LIKE '%/%') AS gap, count(*) AS total
        FROM content_items WHERE text IS NOT NULL AND text <> ''`);
    const signs = one(`
        SELECT (SELECT count(*) FROM memories m
                 WHERE NOT EXISTS (SELECT 1 FROM memory_signs s
                                    WHERE s.memory_id = m.memory_id)) AS gap,
               (SELECT count(*) FROM memories) AS total`);

    const units = podobnyIndex() ?? [];
    const spellings = units.reduce((sum, unit) => sum + unit.spellings.length, 0);
    const dirty = units.filter((unit) => unit.spellings.some((s) => s.mixedScript)).length;

    return {
        id: "corpus",
        title: "Разбор книг",
        source: "корпус typikon-rules (SQLite)",
        metrics: [
            {
                id: "canon-role",
                label: "Каноны без роли",
                gap: num(canons.gap),
                total: num(canons.total),
                note: "Устав адресует канон именем — «канон воскресн», «крестовоскресн», "
                    + "«Богородицы», — и одно из имён умеет пропускать. Пока роль не "
                    + "проставлена, правило может обратиться к канону только порядком печати.",
                manual: true,
            },
            {
                id: "podoben-tone",
                label: "Подобны без гласа",
                gap: num(tones.gap),
                total: num(tones.total),
                note: "Книга подписала место подобном, но гласа не назвала. Напев выбирается "
                    + "подобном и гласом вместе, и без второго выбрать его нельзя.",
                href: "/podobny",
                manual: true,
            },
            {
                id: "podoben-spelling",
                label: "Лишние написания подобнов",
                gap: Math.max(0, spellings - units.length),
                total: spellings,
                note: `${n(units.length)} подобнов напечатаны ${n(spellings)} способами — считая `
                    + "языки порознь: с запятой и без, полным зачином и коротким. Сличаются они "
                    + "нормализацией, так что указателю это не мешает, — но в книгах разнобой "
                    + "остаётся.",
                href: "/podobny",
                manual: true,
            },
            {
                id: "podoben-mixed",
                label: "Подобны с чужой буквой в имени",
                gap: dirty,
                total: units.length,
                note: "В кириллическом имени набрана латинская буква — «Гро́б Тво́й Cпа́се». "
                    + "Опечатка набора: на слияние написаний не влияет, но в книге её стоит "
                    + "поправить, пока она не разошлась дальше.",
                href: "/podobny",
                manual: true,
            },
            {
                id: "irmos-ref",
                label: "Ссылки на ирмос, не нашедшие текста",
                gap: num(irmos.gap),
                total: num(irmos.total),
                note: "Книга печатает ирмос зачином («Ирмо́с: Христо́с ражда́ется:»), а полный "
                    + "текст берётся из Ирмология. Эти зачины своего текста не нашли, и на "
                    + "странице канона останутся обрывком.",
                manual: true,
            },
            {
                id: "colon-markup",
                label: "Строки без разметки колен",
                gap: num(colons.gap),
                total: num(colons.total),
                note: "Напев ложится по коленам, и книга размечает их косой чертой. Где "
                    + "разметки нет, напев показать нельзя вовсе: раскладывать распев по "
                    + "запятым — значит показать его неверно.",
                href: "/tunes",
                manual: true,
            },
            {
                id: "memory-sign",
                label: "Памяти без знака службы",
                gap: num(signs.gap),
                total: num(signs.total),
                note: "Знак Типикона решает, чем память служится. Без него память есть, а "
                    + "разряда службы у неё нет — и в расписание она попадёт наугад.",
                manual: true,
            },
        ],
    };
};

const tunesGroup = (): MetricGroup => {
    const { tunes, traditions } = tuneLibrary();
    const units = podobnyIndex() ?? [];

    // Подобен считается озвученным, если напев на него находится ИМЕННО
    // подобный: гласовый откат тут был бы подлогом — он отвечает на другой
    // вопрос («чем поют, когда подобна нет»).
    const withTune = units.filter((unit) => {
        const name = unit.names[0]?.printed;
        if (!name) return false;
        const found = resolveTune({ tone: unit.tone, podoben: name, genre: "stichera" });
        return found?.tune.select.kind === "podoben";
    }).length;

    const tonesCovered = new Set(
        tunes.flatMap((tune) => (tune.select.kind === "tone" ? [tune.select.tone] : [])),
    );

    return {
        id: "tunes",
        title: "Напевы",
        source: "src/data/tunes — ноты, снятые с книг руками",
        metrics: [
            {
                id: "tune-podoben",
                label: "Подобны без напева",
                gap: Math.max(0, units.length - withTune),
                total: units.length,
                note: `Снято ${n(tunes.length)} ${plural(tunes.length, "напев", "напева", "напевов")} `
                    + `в ${n(traditions.length)} ${plural(traditions.length, "традиции", "традициях", "традициях")}. Ноты `
                    + "снимаются с книг руками, и это не работа для кода: подкладка текста "
                    + "под напев уже написана и ждёт самих напевов.",
                href: "/tunes",
                manual: true,
            },
            {
                id: "tune-tone",
                label: "Гласы без напева",
                gap: Math.max(0, 8 - tonesCovered.size),
                total: 8,
                note: "Гласовый напев — то, чем поют самогласны, у которых подобна нет вовсе. "
                    + "Пока размечены не все восемь, у большинства песнопений напева не будет "
                    + "даже там, где разметка колен есть.",
                href: "/tunes",
                manual: true,
            },
        ],
    };
};

const citationsGroup = async (): Promise<MetricGroup> => {
    const [summary, books] = await Promise.all([citationSummary(), citationBooks()]);
    if (!summary) {
        return {
            id: "citations",
            title: "Отзвуки Писания",
            source: "citation_stats (Монга), считается npm run citations:stats",
            metrics: [],
            unavailable: "Свод цитируемости ни разу не посчитан на этом сервере: "
                + "npm run citations:stats -- --write",
        };
    }

    const db = rulesDb();
    const languages = db ? citationLanguages(db) : null;
    const silentBooks = books.filter((book) => book.verses.any === 0).length;
    const stale = !stampMatches(summary.stamp, corpusStamp());

    const metrics: Metric[] = [
        {
            id: "canon-silent",
            label: "Стихи канона, которых службы не касаются",
            gap: Math.max(0, summary.canonVerses - summary.verses.any),
            total: summary.canonVerses,
            note: "Не недоделка, а наблюдение — ради него свод и заведён: службы и не "
                + "должны пропеть Писание целиком. Строка стоит здесь, чтобы число было "
                + "видно рядом с прочими и не пряталось.",
            href: "/otzvuki",
            observation: true,
        },
        {
            id: "book-silent",
            label: "Книги без единой уверенной цитаты",
            gap: silentBooks,
            total: books.length,
            note: "Ни одного совпадения от пяти слов. Иногда это правда о книге, иногда — "
                + "о сличителе: стоит посмотреть каждую глазами.",
            href: "/otzvuki",
        },
        {
            id: "outside-reference",
            label: "Цитаты мимо справочной разбивки",
            gap: summary.outsideReference,
            total: summary.verses.any,
            note: "Корпус ссылается на стих, которого елизаветинская разбивка в той главе не "
                + "печатает: расхождение версификаций. На охвате это сказывается молча, "
                + "поэтому и вынесено.",
            href: "/otzvuki",
        },
    ];

    if (languages) {
        const missing = languages.all.filter((code) => !languages.cited.has(code));
        metrics.push({
            id: "citation-languages",
            label: "Языки корпуса без разметки цитат",
            gap: missing.length,
            total: languages.all.length,
            note: missing.length
                ? `Размечены только ${[...languages.cited].map(bookLanguageLabel).join(", ")}; `
                    + `${missing.map(bookLanguageLabel).join(", ")} — нет. У этих строк отзвуков `
                    + "не будет вовсе, и на своде это выглядит как молчание Писания, хотя это "
                    + "молчание разметки."
                : "Все языки корпуса размечены.",
            href: "/otzvuki",
        });
    }

    return {
        id: "citations",
        title: "Отзвуки Писания",
        source: "citation_stats (Монга), считается npm run citations:stats",
        metrics,
        unavailable: stale
            ? "Свод посчитан по другой сборке корпуса — числа ниже описывают её, "
                + "пока не пересчитано: npm run citations:stats -- --write"
            : undefined,
    };
};

const textsGroup = async (): Promise<MetricGroup> => {
    const client = await clientPromise;
    const texts = client.db("typikon").collection("texts");

    const [total, presence, texted, correcting] = await Promise.all([
        texts.countDocuments(),
        texts.countDocuments({ readiness: "presence" }),
        texts.countDocuments({ readiness: "texted" }),
        texts.countDocuments({ readiness: "correcting" }),
    ]);

    const coverage = await client.db(ACCENTS_DB).collection("accentCoverage").aggregate([
        { $group: { _id: null, need: { $sum: "$need" }, has: { $sum: "$has" }, docs: { $sum: 1 } } },
    ]).toArray();
    const accents = coverage[0] as { need: number; has: number; docs: number } | undefined;

    return {
        id: "texts",
        title: "Библиотека",
        source: "typikon.texts и typikon-csl.accentCoverage (Монга)",
        metrics: [
            {
                id: "text-presence",
                label: "Заготовки без текста",
                gap: presence,
                total,
                note: "Запись о чтении есть, самого чтения нет. В карту сайта такие не идут, "
                    + "но по ссылке из книги человек на них попадает.",
                href: "/admin/texts",
            },
            {
                id: "text-texted",
                label: "Отекстованы, но не вычитаны",
                gap: texted + correcting,
                total,
                note: "Текст набран или распознан, а сверки с изданием ещё не было. Это не "
                    + "пустота, а недоверенное место: ошибка распознавания читается как текст.",
                href: "/admin/texts",
            },
            {
                id: "accent-marks",
                label: "Недоставленные ударения",
                gap: accents ? Math.max(0, accents.need - accents.has) : 0,
                total: accents?.need ?? null,
                note: accents
                    ? `${n(accents.docs)} ${plural(accents.docs, "текст", "текста", "текстов")} `
                        + "размечены не до конца. Ударения — не украшение: по ним читают вслух, "
                        + "и на них же стоит словарь ударений."
                    : "Счёт по разметке ударений не собран.",
                href: "/accents",
                manual: true,
            },
        ],
    };
};

const linksGroup = async (): Promise<MetricGroup> => {
    const db = (await clientPromise).db("typikon");
    const corpus = rulesDb();

    const [memories, linkedMemories, linkedAkathists, prestoly] = await Promise.all([
        db.collection("memories").countDocuments(),
        db.collection("memory_saint_links").distinct("memoryId").then((ids) => ids.length),
        db.collection("akathist_saint_links").distinct("akathistId").then((ids) => ids.length),
        db.collection("temples").aggregate([
            { $unwind: "$prestoly" },
            {
                $group: {
                    _id: null,
                    all: { $sum: 1 },
                    done: { $sum: { $cond: [{ $eq: ["$prestoly.status", "approved"] }, 1, 0] } },
                },
            },
        ]).toArray().then((rows) => rows[0] as { all: number; done: number } | undefined),
    ]);

    const akathists = corpus
        ? num((corpus.prepare("SELECT count(*) AS n FROM akathists").get() as { n: number }).n)
        : 0;

    const metrics: Metric[] = [
        {
            id: "memory-saint",
            label: "Памяти без святого",
            gap: Math.max(0, memories - linkedMemories),
            total: memories,
            note: "Память календаря не сведена с лицом святцев. Без этой связки на карточке "
                + "памяти нет ни жития, ни икон, ни храмов этого посвящения.",
            href: "/admin/mentions",
        },
    ];

    if (akathists) {
        metrics.push({
            id: "akathist-saint",
            label: "Акафисты без святого",
            gap: Math.max(0, akathists - linkedAkathists),
            total: akathists,
            note: "Акафист лежит в собрании, но неизвестно, кому он поётся: в досье святого "
                + "он не появится, и найти его можно только поиском по названию.",
            href: "/akathists",
        });
    }

    if (prestoly) {
        metrics.push({
            id: "prestol-review",
            label: "Престолы, не разобранные глазами",
            gap: Math.max(0, prestoly.all - prestoly.done),
            total: prestoly.all,
            note: "Посвящение престола выведено из названия храма правилом («…Успения…» → "
                + "Успение). Правило ошибается на редких посвящениях, и до сверки человеком "
                + "эти связи — догадка, а не факт.",
            href: "/dedications",
        });
    }

    return {
        id: "links",
        title: "Связи со святцами",
        source: "typikon: memories, *_saint_links, temples (Монга)",
        metrics,
    };
};

export const collectHealth = async (): Promise<HealthReport> => {
    const [texts, citations, links] = await Promise.all([
        textsGroup(),
        citationsGroup(),
        linksGroup(),
    ]);

    return {
        // Порядок групп — от того, что правится правкой, к тому, что правится
        // разбором книг: сверху работа на вечер, снизу работа на месяцы.
        groups: [texts, links, corpusGroup(), tunesGroup(), citations],
        generatedAt: new Date().toISOString(),
    };
};

import { podobenKey } from "@/lib/tunes/resolve";
import { slugify } from "@/lib/news/format";

// Подобен как единица, а не как строка в столбце.
//
// Подобен — единственный адрес, которым книга сама говорит, КАК петь: «глас 2,
// подобен: До́ме Евфра́фов» значит «на тот самый напев», и напев по нему
// выбирается раньше, чем по гласу (@/lib/tunes/resolve). При этом в корпусе он
// живёт строкой в `groups.podoben`, и строка эта грязная.
//
// ЧТО СКЛЕИВАЕМ И ПОЧЕМУ. Простой GROUP BY по этому столбцу дал бы 974
// «подобна», и среди них — «Гро́б Тво́й, Спа́се», «Гро́б Тво́й Спа́се»,
// «Гро́б Тво́й Cпа́се» (с ЛАТИНСКОЙ C) и «Гро́б Тво́й»: четыре написания одного
// напева. Поэтому написания сводятся нормализацией — той же самой, которой
// напев ищет подобен (podobenKey): два разных ответа на вопрос «это один
// подобен?» в одном продукте недопустимы.
//
// ЯЗЫКИ СВОДИТ КЛЮЧ AGES. У 9 032 групп проставлен `podoben_key`
// (heAU.OsGennaionEnMartysi), и 55 таких ключей из 79 стоят сразу в трёх
// языках. Это готовая связка «греческий самоподобен = славянское имя =
// румынское», и упускать её ради простоты было бы расточительством: без неё
// одно и то же пелось бы на трёх страницах, не знающих друг о друге.
//
// ГДЕ КЛЮЧА НЕТ, единицей становится нормализованное имя ВНУТРИ СВОЕГО ЯЗЫКА.
// Сводить языки по написанию нельзя: «Небе́сных чино́в» и «Τῶν οὐρανίων
// ταγμάτων» — одно и то же, но узнать об этом из самих строк невозможно.
//
// НИЧЕГО ИЗ ЭТОГО НЕ ПРЯЧЕТСЯ. Каждое написание остаётся видимым со своим
// числом, и страница подобна оттого работает ещё и указателем опечаток: 496
// славянских написаний схлопываются в 356.

/** Строка выборки по `groups`: одно написание в одном языке с одним гласом. */
export interface PodobenRow {
    language: string;
    podoben: string;
    podobenKey: string | null;
    tone: number | null;
    groups: number;
    items: number;
}

export interface PodobenSpelling {
    language: string;
    /** Как напечатала книга — с ударениями и запятыми. */
    printed: string;
    /** То, чем написания сличаются. */
    normalized: string;
    groups: number;
    items: number;
    agesKey: string | null;
    /** Ключ достался не от книги, а по совпадению имени с ключевым написанием. */
    byName: boolean;
    /** В кириллическом имени стоит латинская буква (или наоборот). */
    mixedScript: boolean;
    /** Не имя вовсе: разметка издания, попавшая в столбец имени. */
    artefact: boolean;
}

export interface PodobenName {
    language: string;
    printed: string;
    items: number;
}

export interface PodobenUnit {
    /** Внутренний ключ единицы: "key:heAU.…" либо "name:cu_gr|доме евфрафов". */
    unitId: string;
    slug: string;
    agesKey: string | null;
    /** Имена по языкам, славянское первым; заголовок страницы — names[0]. */
    names: PodobenName[];
    /** Преобладающий глас. */
    tone: number | null;
    /** Гласы, отклонившиеся от преобладающего: разбор устава, а не шум. */
    toneOutliers: Array<{ tone: number | null; items: number }>;
    groups: number;
    items: number;
    spellings: PodobenSpelling[];
    languages: Array<{ code: string; items: number }>;
}

/**
 * «Αὐτόμελον» — не имя подобна.
 *
 * Так издание AGES помечает сам образец: «поётся своим напевом». В столбец
 * имени эта пометка попала разбором, и стоит она на 85 греческих группах,
 * разбросанных по 50 ключам. Показать её подобном значило бы завести подобен
 * с именем «самоподобен», на который якобы поётся полсотни разных напевов.
 *
 * Строки эти не выбрасываются: у них есть ключ, и по ключу они ложатся к своей
 * единице. Скрыто только имя — и о том, что оно скрыто, страница говорит.
 * Указывать на самоподобен они, вопреки ожиданию, не годятся: у ключа
 * heAU.TonOuranionTagmaton так помечена группа, чья первая стихира —
 * «Ἐν τῷ Σταυρῷ θεωροῦσα», то есть подражание, а не образец.
 */
const ARTEFACTS = new Set(["αυτομελον"]);

const bare = (value: string) =>
    value.normalize("NFD").replace(/\p{Mn}/gu, "").toLowerCase();

/**
 * Латинские буквы, набранные вместо кириллических.
 *
 * В корпусе их немного и они дороги: «Гро́б Тво́й, Cпа́се» и «Kpacoте́ де́вства»
 * — по одной строке каждая, и без этого сложения они завели бы себе по
 * отдельному подобну с одной стихирой, а настоящий подобен недосчитался бы её.
 * Складываем только там, где в имени УЖЕ есть кириллица: иначе румынское
 * «Casa Eufratului» превратилось бы в кириллическую бессмыслицу.
 */
const HOMOGLYPHS: Record<string, string> = {
    a: "а", b: "ь", c: "с", e: "е", h: "н", i: "і", j: "ј", k: "к", m: "м",
    o: "о", p: "р", s: "ѕ", t: "т", u: "и", x: "х", y: "у",
};

export const foldHomoglyphs = (value: string): string => {
    if (!/\p{Script=Cyrillic}/u.test(value)) return value;
    return value
        .split("")
        .map((char) => {
            const lower = char.toLowerCase();
            const folded = HOMOGLYPHS[lower];
            if (!folded || !/\p{Script=Latin}/u.test(char)) return char;
            return char === lower ? folded : folded.toUpperCase();
        })
        .join("");
};

export const isArtefactName = (printed: string): boolean =>
    ARTEFACTS.has(bare(printed).replace(/[^\p{L}]/gu, ""));

/**
 * Написание, набранное в двух алфавитах сразу.
 *
 * Ловит «Гро́б Тво́й Cпа́се», где C — латинская: на глаз это то же слово, для
 * машины — другое, и без нормализации оно завело бы себе отдельный подобен.
 * Сообщать об этом стоит там же, где написания и показаны: опечатка живёт в
 * книге, и правится она в книге, а не здесь.
 */
export const mixedScript = (printed: string): boolean => {
    const cyrillic = /\p{Script=Cyrillic}/u.test(printed);
    const latin = /\p{Script=Latin}/u.test(printed);
    const greek = /\p{Script=Greek}/u.test(printed);
    return [cyrillic, latin, greek].filter(Boolean).length > 1;
};

/** Языки в том порядке, в каком их предпочитает заголовок. */
const LANGUAGE_ORDER = ["cu_gr", "ro", "grc", "en", "ar"];

const languageRank = (code: string) => {
    const index = LANGUAGE_ORDER.indexOf(code);
    return index === -1 ? LANGUAGE_ORDER.length : index;
};

/**
 * Греческое имя латиницей — для адреса страницы.
 *
 * Общий транслитератор проекта знает одну кириллицу, и греческое имя он
 * обращает в пустоту. Единиц, у которых нет ни славянского, ни румынского
 * имени, всего десяток, но адрес нужен и им.
 */
const GREEK: Record<string, string> = {
    α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i",
    κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s",
    ς: "s", τ: "t", υ: "y", φ: "f", χ: "h", ψ: "ps", ω: "o",
};

// Двубуквенные сперва: «Τῶν οὐρανίων» без них даёт «oyranion» вместо
// «ouranion», то есть расходится с тем, как пишет сам AGES в своих ключах, —
// а по этим ключам адреса и сверяются глазом.
const GREEK_PAIRS: Array<[RegExp, string]> = [
    [/ου/g, "ou"], [/ευ/g, "ev"], [/αυ/g, "av"], [/γγ/g, "ng"],
];

const transliterate = (value: string): string => {
    const folded = GREEK_PAIRS.reduce((acc, [from, to]) => acc.replace(from, to), bare(value));
    return folded.split("").map((char) => GREEK[char] ?? char).join("");
};

/** Хвост ключа AGES: heAU.OsGennaionEnMartysi → os-gennaion-en-martysi. */
export const keySlug = (agesKey: string): string =>
    agesKey
        .split(".").pop()!
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

/**
 * Единицы из строк выборки.
 *
 * Три шага, и порядок их важен: сперва ключ книги, потом ключ по совпадению
 * имени, и только потом — имя само по себе. Второй шаг возвращает к своей
 * единице те написания, где книга ключа не поставила, а имя то же самое
 * («Я́ко до́бля» рядом с «Я́ко до́бля в му́ченицех»).
 */
export const podobenUnits = (rows: PodobenRow[]): PodobenUnit[] => {
    const normalized = rows.map((row) => ({
        row,
        norm: podobenKey(foldHomoglyphs(row.podoben)),
        artefact: isArtefactName(row.podoben),
    }));

    // Шаг 2: имя внутри языка -> ключ, который книга поставила где-то ещё.
    // Спорные случаи (одно имя на два ключа) решаются большинством строк, и
    // меньшинство не пропадает: оно останется видимым написанием у победителя.
    const byName = new Map<string, Map<string, number>>();
    for (const { row, norm, artefact } of normalized) {
        if (!row.podobenKey || artefact) continue;
        const nameKey = `${row.language}|${norm}`;
        const votes = byName.get(nameKey) ?? new Map<string, number>();
        votes.set(row.podobenKey, (votes.get(row.podobenKey) ?? 0) + row.items);
        byName.set(nameKey, votes);
    }
    const winner = new Map<string, string>();
    for (const [nameKey, votes] of byName) {
        const best = [...votes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
        if (best) winner.set(nameKey, best[0]);
    }

    interface Draft {
        unitId: string;
        agesKey: string | null;
        spellings: Map<string, PodobenSpelling>;
        tones: Map<number | null, number>;
        groups: number;
        items: number;
    }

    const drafts = new Map<string, Draft>();

    for (const { row, norm, artefact } of normalized) {
        const nameKey = `${row.language}|${norm}`;
        const key = row.podobenKey ?? (artefact ? null : winner.get(nameKey) ?? null);
        const unitId = key ? `key:${key}` : `name:${nameKey}`;

        const draft = drafts.get(unitId) ?? {
            unitId,
            agesKey: key,
            spellings: new Map<string, PodobenSpelling>(),
            tones: new Map<number | null, number>(),
            groups: 0,
            items: 0,
        };

        const spellingKey = `${row.language}|${row.podoben}`;
        const spelling = draft.spellings.get(spellingKey) ?? {
            language: row.language,
            printed: row.podoben,
            normalized: norm,
            groups: 0,
            items: 0,
            agesKey: row.podobenKey,
            byName: !row.podobenKey && !!key,
            mixedScript: mixedScript(row.podoben),
            artefact,
        };
        spelling.groups += row.groups;
        spelling.items += row.items;
        // Одно и то же написание книга могла подписать ключом в одном месте и
        // не подписать в другом. Ключ у написания тогда есть, и «примкнуло по
        // имени» о нём сказать нельзя: сказано это только о написаниях,
        // которых книга ключом не подписала НИ РАЗУ.
        if (row.podobenKey) {
            spelling.agesKey = row.podobenKey;
            spelling.byName = false;
        }
        draft.spellings.set(spellingKey, spelling);

        draft.tones.set(row.tone, (draft.tones.get(row.tone) ?? 0) + row.items);
        draft.groups += row.groups;
        draft.items += row.items;
        drafts.set(unitId, draft);
    }

    const units: PodobenUnit[] = [...drafts.values()].map((draft) => {
        const spellings = [...draft.spellings.values()]
            .sort((a, b) => b.items - a.items || a.printed.localeCompare(b.printed));

        // Имя языка — самое частое его написание, кроме пометки издания.
        const byLanguage = new Map<string, PodobenSpelling[]>();
        for (const spelling of spellings) {
            if (spelling.artefact) continue;
            byLanguage.set(spelling.language, [...(byLanguage.get(spelling.language) ?? []), spelling]);
        }

        const names: PodobenName[] = [...byLanguage.entries()]
            .map(([language, list]) => ({
                language,
                printed: list[0].printed,
                items: list.reduce((sum, s) => sum + s.items, 0),
            }))
            .sort((a, b) => languageRank(a.language) - languageRank(b.language));

        const tones = [...draft.tones.entries()].sort((a, b) => b[1] - a[1]);
        const tone = tones.length ? tones[0][0] : null;

        return {
            unitId: draft.unitId,
            slug: "",
            agesKey: draft.agesKey,
            names,
            tone,
            toneOutliers: tones.slice(1).map(([value, items]) => ({ tone: value, items })),
            groups: draft.groups,
            items: draft.items,
            spellings,
            languages: [...byLanguage.entries()]
                .map(([code, list]) => ({ code, items: list.reduce((sum, s) => sum + s.items, 0) }))
                .sort((a, b) => b.items - a.items),
        };
    });

    return assignSlugs(units);
};

const slugCandidates = (unit: PodobenUnit): string[] => [
    ...unit.names.map((name) => {
        const slug = slugify(transliterate(name.printed));
        // slugify отдаёт «novost» вместо пустого — здесь это было бы враньём.
        return slug === "novost" ? "" : slug;
    }),
    unit.agesKey ? keySlug(unit.agesKey) : "",
];

/**
 * Адреса страниц.
 *
 * Слаг выводится из имени, а не хранится: хранить его значило бы завести
 * таблицу, которая живёт дольше корпуса и расходится с ним молча. Цена —
 * адрес может измениться, если у подобна сменится преобладающее написание;
 * страховка от этого — поиск по ВСЕМ именам единицы, а не только по
 * выбранному (см. getPodoben в store.ts).
 *
 * Порядок назначения — по числу стихир, убывая: он не зависит от того, в
 * каком порядке база вернула строки, и оттого одинаков от сборки к сборке.
 */
const assignSlugs = (units: PodobenUnit[]): PodobenUnit[] => {
    const taken = new Set<string>();
    return [...units]
        .sort((a, b) => b.items - a.items || a.unitId.localeCompare(b.unitId))
        .map((unit) => {
            const base = slugCandidates(unit).find(Boolean) || "podoben";
            let slug = base;
            for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
            taken.add(slug);
            return { ...unit, slug };
        });
};

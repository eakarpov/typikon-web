// Разбор статей «Библейской энциклопедии архимандрита Никифора» (М., 1891) из
// вики-разметки Викитеки (страницы «БЭАН/…») в текст корпуса.
//
// Сочинение — общественное достояние. Викитека даёт его вычитанным (КАЧЕСТВО 3 и 4
// у 4246 статей из 4583), с проставленными ссылками на Писание и между статьями.
//
// ВО ЧТО ПЕРЕВОДИТСЯ:
//   '''жирный''', ''курсив''       → **жирный**, *курсив* (текст идёт с newUi: markdown);
//   [[БЭАН/Статья|подпись]]        → {t|@@Статья@@|подпись}: на месте @@…@@ импорт
//                                    ставит алиас статьи в корпусе, а ссылку на
//                                    отсутствующую статью разворачивает в подпись;
//   {{Библия|Быт|28:19|т=XXVIII, 19}} → «XXVIII, 19» — как напечатано в издании; сама
//                                    ссылка сохраняется в `bibleRefs` для сопоставления
//                                    с местами и упоминаний в Писании;
//   {{опечатка|было|стало|…}}     → «стало»: исправление Викитеки принимается;
//   картинки, якоря, категории, служебные примечания Викитеки — выбрасываются.
//
// Незнакомый шаблон тоже выбрасывается, но попадает в `unknownTemplates`: импорт
// печатает их, и новая разметка не пропадёт молча.

export interface BibleRef {
    /** Сокращение книги, как в шаблоне Викитеки: «Быт», «3Цар», «Мк». */
    book: string;
    chapter: number;
    verse?: number;
    /** «28:19», «5:12-14» — как в шаблоне. */
    ref: string;
}

export type Parsed =
    | { kind: "redirect"; title: string; target: string }
    | {
        kind: "article";
        title: string;
        /** Заголовок статьи без префикса: «Авва (город)». */
        name: string;
        /** Первое слово статьи жирным: «Авва». */
        headword: string;
        content: string;
        /** Статьи, на которые ссылается текст, — заголовки без префикса. */
        links: string[];
        bibleRefs: BibleRef[];
        /** Параметр ВИКИПЕДИЯ шапки: название статьи русской Википедии, если указано. */
        wikipedia?: string;
        quality?: string;
        disambiguation: boolean;
        unknownTemplates: string[];
    };

export const PREFIX = "БЭАН/";

const stripPrefix = (title: string) => title.startsWith(PREFIX) ? title.slice(PREFIX.length) : title;

/** Цель ссылки на статью: «БЭАН/Ефиопия», «../Вааса» → «Ефиопия», «Вааса»; прочее — null. */
export const articleTarget = (link: string): string | null => {
    const target = link.split("#")[0].trim();
    if (target.startsWith(PREFIX)) return stripPrefix(target);
    if (target.startsWith("../")) return target.slice(3);
    return null;
};

const splitParams = (inner: string) => inner.split("|").map((p) => p.trim());
// В шапке параметры пишут с пробелами вокруг «=» («ВИКИПЕДИЯ = Барада»), в ссылке
// на Писание — слитно («т=V, 12»).
const namedParam = (params: string[], name: string) => {
    const param = params.find((p) => new RegExp(`^${name}\\s*=`).test(p));
    return param?.slice(param.indexOf("=") + 1).trim();
};
const positional = (params: string[]) => params.filter((p) => !/^[^=\s]+\s*=/.test(p));

const DROPPED = new Set([
    "ifloat", "rfloat", "lfloat", "inline float", "якорь", "примечание вт", "примечания вт",
    "навигация", "неоднозначность", "tr", "бэан",
]);

/** Разворот одного шаблона, в котором уже нет вложенных. */
const expandTemplate = (inner: string, refs: BibleRef[], unknown: string[], flags: { disambiguation: boolean }): string => {
    const params = splitParams(inner);
    const name = params[0].toLowerCase();
    const args = positional(params.slice(1));

    switch (name) {
        case "библия": {
            const [book, ref] = args;
            const m = ref?.match(/^(\d+)(?::(\d+))?/);
            if (book && m) refs.push({ book, chapter: Number(m[1]), ...(m[2] ? { verse: Number(m[2]) } : {}), ref });
            return (namedParam(params, "т") ?? ref ?? "").replace(/ /g, " ");
        }
        case "опечатка": return args[1] ?? args[0] ?? "";
        case "lang": return args[1] ?? "";
        case "razr": case "razr2": case "ditto": case "центр": case "нет ошибки": return args[0] ?? "";
        case "дробь": return args.length >= 3 ? `${args[0]} ${args[1]}/${args[2]}` : args.join("/");
        case "---": return "—";
    }
    if (name === "неоднозначность") flags.disambiguation = true;
    if (!DROPPED.has(name)) unknown.push(params[0]);
    return "";
};

/** Таблица Викитеки (их две, списки царей) — строками «ячейка — ячейка». */
const flattenTables = (text: string) => text.replace(/^\{\|[\s\S]*?^\|\}/gm, (table) =>
    table.split("\n")
        .filter((line) => !/^\s*(\{\||\|\}|\|-)/.test(line))
        .map((line) => line.replace(/^\s*[!|]\s*/, "").replace(/\s*(\|\||!!)\s*/g, " — ").replace(/(^|\s)(colspan|rowspan|style|align)=\S+\s*\|?/g, " ").trim())
        .filter(Boolean)
        .join("\n"));

export const parseArticle = (title: string, wikitext: string): Parsed => {
    const redirect = wikitext.match(/^\s*#(?:перенаправление|redirect)\s*\[\[([^\]|]+)/i);
    if (redirect) return { kind: "redirect", title, target: articleTarget(redirect[1]) ?? stripPrefix(redirect[1]) };

    const refs: BibleRef[] = [];
    const unknown: string[] = [];
    const flags = { disambiguation: false };

    const header = wikitext.match(/\{\{БЭАН([^{}]*)\}\}/);
    const headerParams = header ? splitParams(header[1].replace(/\n/g, "")) : [];
    const wikipedia = namedParam(headerParams, "ВИКИПЕДИЯ") || undefined;
    const quality = namedParam(headerParams, "КАЧЕСТВО") || undefined;

    let text = wikitext
        .replace(/\{\{БЭАН[^{}]*\}\}/g, "")
        .replace(/\[\[Категория:[^\]]*\]\]/g, "")
        .replace(/<\/?center>/gi, "")
        .replace(/<br\s*\/?>/gi, "\n");

    // Шаблоны изнутри наружу: в «т=» ссылки на Писание бывает вложена «опечатка».
    for (let guard = 0; /\{\{[^{}]*\}\}/.test(text) && guard < 10; guard++) {
        text = text.replace(/\{\{([^{}]*)\}\}/g, (_, inner) => expandTemplate(inner, refs, unknown, flags));
    }

    text = flattenTables(text);

    const links: string[] = [];
    text = text.replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_, target: string, label?: string) => {
        const article = articleTarget(target);
        const shown = (label ?? stripPrefix(target.replace(/^\.\.\//, "")).split("#")[0]).trim();
        if (!article) return shown;
        links.push(article);
        return `{t|@@${article}@@|${shown}}`;
    });

    const headword = text.match(/'''([^']+?)'''/)?.[1].replace(/[.,:;]+$/, "").trim() ?? stripPrefix(title);

    text = text
        .replace(/'''(.+?)'''/g, "**$1**")
        .replace(/''(.+?)''/g, "*$1*")
        .replace(/^(=+)\s*(.+?)\s*\1\s*$/gm, "**$2**")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    return {
        kind: "article",
        title,
        name: stripPrefix(title),
        headword,
        content: text,
        links,
        bibleRefs: refs,
        ...(wikipedia ? { wikipedia } : {}),
        ...(quality ? { quality } : {}),
        disambiguation: flags.disambiguation,
        unknownTemplates: unknown,
    };
};

/**
 * Подстановка алиасов вместо «@@Статья@@». Перенаправление ведёт к цели; ссылка на
 * статью, которой в корпусе нет, разворачивается в свою подпись.
 */
export const resolveLinks = (
    content: string,
    aliasOf: (article: string) => string | undefined,
): { content: string; unresolved: string[] } => {
    const unresolved: string[] = [];
    const out = content.replace(/\{t\|@@(.+?)@@\|([^}]*)\}/g, (_, article: string, label: string) => {
        const alias = aliasOf(article);
        if (alias) return `{t|${alias}|${label}}`;
        unresolved.push(article);
        return label;
    });
    return { content: out, unresolved };
};

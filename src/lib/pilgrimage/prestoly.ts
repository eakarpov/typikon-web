// Разбор престолов со страниц приходских сайтов: чистая часть. Сеть и запись —
// в src/scripts/crawl-temple-prestoly.ts.
//
// ЗАЧЕМ ЭТО. Имя храма называет один престол, а приделов у него бывает два и
// три, и знает о них только приход: в открытых данных престола полем нет вовсе
// (у Wikidata «назван в честь» заполнено у 979 храмов из 11 763, у OSM тег
// dedication — у четырёх), частные своды авторские и целиком не берутся
// (@/utils/templeSources). Сайт прихода говорит о себе сам, и его разбор ничьей
// собственности не задевает: отдельный факт «у этого храма придел такой-то»
// ничей, в отличие от свода.
//
// РАЗБОР ПРОЗЫ — ДОГАДКА БОЛЬШАЯ, ЧЕМ РАЗБОР ИМЕНИ. Словарь посвящений
// (@/utils/dedications) писан по названиям храмов и в живой речи ошибается
// чаще: «в честь победы» рядом со словом «престол» престолом быть не должно.
// Поэтому разбор точен ровно настолько, насколько короток и явен отрывок
// вокруг слова «престол», «придел» или «освящён», и каждую догадку
// сопровождает ОТРЫВОК, из которого она взята: без него разбирающему нечего
// проверять. Найденное идёт престолом со статусом `pending` и никогда — сразу
// за факт.
//
// ЧТО СЧИТАЕТСЯ ГЛАВНЫМ. Главным называем престол, про который сказано
// «главный» или «центральный», иначе первый по тексту; приделы главными не
// бывают. Помета ищется ближайшая к слову престола — и до него, и после, —
// потому что «главный престол, придельный — …» и «придельный престол, главный
// — …» говорят разное, а стоят почти одинаково. Престол с пометой «главный»
// один: даже если их названо два, это сводится к одному здесь же.

import { matchDedications, type DedicationKind } from "@/utils/dedications";

export interface PrestolGuess {
    /** Ключ посвящения в словаре — им престол и записывается. */
    dedication: string;
    label: string;
    kind: DedicationKind;
    isMain: boolean;
    /** Отрывок страницы, откуда взят престол: его видит разбирающий. */
    phrase: string;
    /** Каким ярусом словаря нашлось: точный образец надёжнее короткой основы. */
    tier: "pattern" | "stem";
    pattern: string;
    confidence: number;
}

/**
 * Зачины перечня. Не «любое слово с этими буквами», а имена престола и
 * придела — и только они: «священник», «освящение», «освящённый праздник»
 * престолов не называют, а «освящ» в них куда чаще, чем «освящён во имя».
 * Причастия («освящённым», «освящённую») отсекает запрет следующей буквы:
 * краткая форма глагола оканчивается на «освящён/освящена/освящено/освящены».
 */
const LABEL = /(придел[а-яё]*|престол[а-яё]*|освящ(?:ён|ена|ено|ены)(?![а-яёa-z]))/gi;

/** «Престольный праздник» — не перечень престолов, а календарь: его пропускаем. */
const NOT_A_LIST = /^престольн/;

/** Как назван престол: «во имя» и «в честь». */
const HONOR = /(в\s+(?:честь|память|славу|похвалу)|во\s+имя)/i;

/** Двоеточие или тире после слова-зачина — начало перечня. */
const LIST_SEP = /[:—–]/;

/** «Главный», «центральный» — престол, названный так, и есть главный. */
const MAIN_WORD = /(главн[а-яё]*|центральн[а-яё]*)/gi;
/**
 * «Придельный», сторона, порядковый номер — престол не главный. Образцы
 * нарочно узкие: «прав(ый)» — сторона, а «православный» и «праведный» — нет;
 * «лев(ый)» — сторона, а «лев» (зверь) сюда не попадает.
 */
const SIDE_WORD = /(придел[а-яё]*|боков[а-яё]*|лев(ый|ая|ое|ого|ому|ым|ой|ом|ую|ою|ых|ые|ыми|ей)|прав(ый|ая|ое|ого|ому|ым|ой|ом|ую|ою|ых|ые|ыми|ей)|втор(ой|ая|ое|ого|ому|ым|ом)|трет(ий|ья|ье|ьего|ьему|ьим|ьем)|северн[а-яё]*|южн[а-яё]*|средн[а-яё]*|нижн[а-яё]*|верхн[а-яё]*)/gi;

/**
 * Сокращения, после которых точка — не конец предложения. Их приходится
 * знать поимённо: «придел во имя св. Николая» обрывать на «св.» нельзя —
 * вместе с точкой ушло бы и имя престола.
 */
const ABBR = /(^|\s)(св|свт|прп|прмч|прмц|вмч|вмц|мч|мц|сщмч|сщмц|блж|блаж|прав|праведн|ап|арх|архиеп|еп|митр|патр|прот|протопр|иером|игум|мон|диак|кн|цар|цариц|пресв|божией|богородиц|им|см|г|гг|вв|т\.?\s?е|др)\.$/i;

const hasAny = (rx: RegExp, s: string): boolean => { rx.lastIndex = 0; return rx.test(s); };

/** Помета главного или придельного, ближайшая к концу строки: null — помет нет. */
const lastFacet = (before: string): boolean | null => {
    let facet: boolean | null = null;
    let at = -1;
    for (const rx of [MAIN_WORD, SIDE_WORD]) {
        rx.lastIndex = 0;
        for (let m = rx.exec(before); m; m = rx.exec(before)) {
            if ((m.index ?? 0) >= at) { at = m.index ?? 0; facet = rx === MAIN_WORD; }
        }
    }
    return facet;
};

/**
 * Конец предложения от этой точки: первая точка, вопросительный или
 * восклицательный знак, после которого пробел или конец, и притом не
 * сокращение. Возвращает смещение или конец текста.
 */
const sentenceEnd = (text: string, from: number): number => {
    const TAIL = /[.!?]+(?=\s|$)/g;
    TAIL.lastIndex = from;
    for (let m = TAIL.exec(text); m; m = TAIL.exec(text)) {
        const at = m.index;
        if (m[0].startsWith(".") && ABBR.test(text.slice(Math.max(0, at - 14), at + 1))) continue;
        return at;
    }
    return text.length;
};

interface Claim {
    kind: "prestol" | "pridel" | "osvyash";
    /** Отрывок после слова-зачина, по которому ищем посвящение. */
    phrase: string;
    /** Главный ли престол, если пометы в самом отрывке нет. */
    baseMain: boolean;
}

/** Смещение первой пустой строки от этой точки — там кончается перечень. */
const blankEnd = (text: string, from: number): number => {
    const at = text.slice(from).search(/\n[ \t]*\n/);
    return at < 0 ? -1 : from + at;
};

/** Утверждения о престолах: где сказано «престол», «придел» или «освящён». */
const claimsOf = (text: string): Claim[] => {
    const marks: { at: number; end: number; kind: Claim["kind"]; style: "list" | "honor" }[] = [];
    for (const m of text.matchAll(LABEL)) {
        const at = m.index ?? 0;
        const tail = text.slice(at, at + 16).toLowerCase();
        if (NOT_A_LIST.test(tail)) continue;
        const kind = tail.startsWith("придел") ? "pridel" : tail.startsWith("освящ") ? "osvyash" : "prestol";
        const end = at + m[0].length;
        // Слово-зачин стало зачином перечня, только если за ним идёт или
        // двоеточие с тире, или «во имя/в честь». Иначе это «престол Божий»,
        // «патриарший престол», «освящена в 1903 году» — не о престоле храма.
        const after = text.slice(end, end + 50);
        const honor = HONOR.test(after);
        const sep = LIST_SEP.test(text.slice(end, end + 24));
        // Перечень с зачином столбиком: «Престолы» строкой, а под ним список.
        const heading = /^\s*\n/.test(after);
        if (kind === "osvyash" ? !honor : !(honor || sep || heading)) continue;
        // «в честь — X» — не перечень с тире, а названный престол: узкое окно.
        marks.push({ at, end, kind, style: honor ? "honor" : "list" });
    }

    return marks.map((mark, i) => {
        const next = marks[i + 1]?.at ?? Infinity;
        // У перечня окно шире: за ним идёт список столбиком и в строку.
        // У «во имя/в честь» — узкое: там назван один престол, а дальше в
        // прозе начинается чужое (святыни, клирики, соседний храм).
        const bounds = [next];
        if (mark.style === "honor") {
            bounds.push(sentenceEnd(text, mark.end), mark.end + 140);
            const nl = text.indexOf("\n", mark.end);
            if (nl >= 0) bounds.push(nl);
        } else {
            const blank = blankEnd(text, mark.end);
            bounds.push(blank >= 0 ? blank : mark.end + 240);
        }
        const phrase = text.slice(mark.end, Math.min(...bounds)).replace(/\s+/g, " ").trim();
        // Помета может стоять до слова-зачина: «левый придел освящён…». Берём
        // ближайшую к зачину, а не любую в окне: «главный престол, придельный —
        // …» говорит о придельном.
        const before = text.slice(Math.max(0, mark.at - 40), mark.at);
        const near = lastFacet(before);
        const baseMain = mark.kind !== "pridel" && near !== false;
        return { kind: mark.kind, phrase, baseMain };
    });
};

/**
 * Отрывок, разделённый пометами: каждая часть со своим «главный/придельный».
 * Так «придельный — Николая, главный — Успения» даёт верное и тому и другому,
 * а не одну помету на весь отрывок.
 */
const segmentsOf = (phrase: string, baseMain: boolean): { text: string; isMain: boolean; facet: boolean }[] => {
    const facets: { at: number; isMain: boolean }[] = [];
    for (const rx of [MAIN_WORD, SIDE_WORD]) {
        rx.lastIndex = 0;
        for (let m = rx.exec(phrase); m; m = rx.exec(phrase)) facets.push({ at: m.index ?? 0, isMain: rx === MAIN_WORD });
    }
    if (!facets.length) return [{ text: phrase, isMain: baseMain, facet: false }];
    facets.sort((a, b) => a.at - b.at);

    const out: { text: string; isMain: boolean; facet: boolean }[] = [];
    if (facets[0].at > 0) out.push({ text: phrase.slice(0, facets[0].at), isMain: baseMain, facet: false });
    facets.forEach((f, i) => {
        const end = facets[i + 1]?.at ?? phrase.length;
        const text = phrase.slice(f.at, end).trim();
        if (text) out.push({ text, isMain: f.isMain, facet: true });
    });
    return out;
};

/**
 * Насколько догадке можно верить. Точный образец называет посвящение, короткая
 * основа лишь совпадает буквами; главный престол назван прямее придельного, а
 * «освящён» — описательнее обоих.
 */
const confidenceOf = (tier: "pattern" | "stem", isMain: boolean, kind: Claim["kind"]): number => {
    let c = tier === "pattern" ? 0.8 : 0.5;
    if (isMain) c += 0.05;
    if (kind === "osvyash") c -= 0.05;
    return Math.round(c * 100) / 100;
};

/**
 * Престолы, названные на странице. Одинаковые посвящения сводятся, порядок —
 * по первому упоминанию; главный остаётся один: названный таковым, а не то
 * первый по тексту.
 */
export const thronesOfText = (text: string): PrestolGuess[] => {
    const bySlug = new Map<string, PrestolGuess & { order: number }>();
    let order = 0;
    // Придельная помета без главной — не повод гадать: приход назвал только
    // придел, а главный престол и так стоит в имени храма. Тогда ни одного
    // главного здесь не ставим.
    let sawSide = false;

    for (const claim of claimsOf(text)) {
        if (!claim.phrase) continue;
        if (!claim.baseMain) sawSide = true;
        for (const segment of segmentsOf(claim.phrase, claim.baseMain)) {
            if (segment.facet && !segment.isMain) sawSide = true;
            for (const hit of matchDedications(segment.text)) {
                const d = hit.dedication;
                const confidence = confidenceOf(hit.tier, segment.isMain, claim.kind);
                const prev = bySlug.get(d.slug);
                if (!prev) {
                    bySlug.set(d.slug, {
                        dedication: d.slug, label: d.label, kind: d.kind, isMain: segment.isMain,
                        phrase: claim.phrase, tier: hit.tier, pattern: hit.pattern, confidence, order: order++,
                    });
                    continue;
                }
                // Повтор того же престола уточняет, а не размножает: главный он,
                // если хоть где-то назван главным, а уверенность берём наибольшую.
                prev.isMain = prev.isMain || segment.isMain;
                if (hit.tier === "pattern") { prev.tier = "pattern"; prev.pattern = hit.pattern; }
                prev.confidence = Math.max(prev.confidence, confidence);
            }
        }
    }

    const list = [...bySlug.values()].sort((a, b) => a.order - b.order);
    const mainAt = list.findIndex((g) => g.isMain);
    const main = mainAt >= 0 ? mainAt : sawSide ? -1 : 0;
    return list.map((g, i) => {
        const { order: _order, ...rest } = g;
        return { ...rest, isMain: i === main };
    });
};

/** Текст узла без тегов: только слова — для полей Соборов.ру. */
const stripTags = (html: string): string => html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/&laquo;/gi, "«")
    .replace(/&raquo;/gi, "»")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Престолы со страницы объекта Соборов.ру. Здесь они выписаны ЯВНЫМ ПОЛЕМ
 * («Престолы:» в списке свойств), а не в прозе, и каждое имя стоит ссылкой на
 * свою метку. Разбор прозы тут не только не нужен, но и вреден: рядом лежат
 * «Епархия» и «Адрес», и «Борисоглебская епархия» дала бы ложного Бориса и
 * Глеба. Условия «Соборов.ру» касаются снимков и требуют ссылки, отдельный же
 * факт-престол ничей (@/utils/templeSources, правило «facts»).
 *
 * Главным считается первый выписанный престол: Соборы.ру держат этот порядок.
 */
export const thronesOfSobory = (html: string): PrestolGuess[] => {
    const field = /<dt>\s*Престолы:?\s*<\/dt>\s*<dd>([\s\S]*?)<\/dd>/i.exec(html)?.[1];
    if (!field) return [];

    // Имена престолов — ссылки на метки (/mapsearch/?altar=NNN). Если ссылок
    // нет, берём текст поля: он перечисляет те же имена через запятую.
    const items: string[] = [];
    for (const m of field.matchAll(/<a\b[^>]*href=["'][^"']*altar=[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)) {
        items.push(m[1]);
    }
    if (!items.length) items.push(...field.split(/[,;]/));

    const out: PrestolGuess[] = [];
    let mainTaken = false;
    for (const raw of items) {
        const text = stripTags(raw);
        if (!text) continue;
        for (const hit of matchDedications(text)) {
            if (out.some((g) => g.dedication === hit.dedication.slug)) continue;
            const isMain = !mainTaken;
            if (isMain) mainTaken = true;
            out.push({
                dedication: hit.dedication.slug,
                label: hit.dedication.label,
                kind: hit.dedication.kind,
                isMain,
                phrase: text,
                tier: hit.tier,
                pattern: hit.pattern,
                confidence: confidenceOf(hit.tier, isMain, "prestol"),
            });
        }
    }
    return out;
};

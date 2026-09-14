// Сопоставление мест со статьями «Библейской энциклопедии» архимандрита Никифора.
//
// ДВА ПУТИ. Первый — Wikidata: у 1667 элементов энциклопедия указана источником
// (P1343) с элементом самой статьи (P805), и такое сопоставление сделано людьми —
// оно принимается без проверки. Второй — по стихам: статья о месте ссылается на
// те же стихи, в которых OpenBible нашёл это место. Этот путь угадывает, поэтому
// сам принимает только надёжное, остальное уходит на ревью.
//
// ОБЩИЙ СТИХ И СОЗВУЧНОЕ ИМЯ. Большинство мест упомянуто в одном-двух стихах, и тем
// же стихом пользуются статьи о людях («Авиасаф» и город, где он жил). Отличает
// статью о месте имя: у места из OpenBible оно английское, у статьи — в синодальной
// передаче, но это одно еврейское имя, и согласный остов у них общий
// (Beth-aven ~ Беф-Авен, Chebar ~ Хевар). Пары с созвучным именем принимаются;
// без созвучия — только взаимно лучшая пара (статья лучшая для места и место лучшее
// для статьи) с тремя и более общими стихами при отрыве от второго кандидата.
import { canonBookByAbbr } from "@/utils/bibleCanon";

export interface RuRef { book: string; ref: string }

/** Сокращения Викитеки, отличные от сокращений канона сайта. */
const ABBR_ALIASES: Record<string, string> = {
    "1Ездр": "1Езд", "2Ездр": "2Езд", "3Ездр": "3Езд",
    "Эсф": "Есф", "Иудф": "Иудиф", "Притч": "Прит", "Агг": "Аг", "Амос": "Ам", "Иоан": "Ин",
};

const MAX_RANGE = 40;

/**
 * Ключи стихов ссылки: «5:12» → «4-tsarstv.5.12»; «5:12-14» — три ключа; ссылка на
 * главу целиком ключей не даёт: она ничего не говорит о месте.
 */
export const refKeys = (r: RuRef): string[] => {
    const book = canonBookByAbbr(ABBR_ALIASES[r.book] ?? r.book);
    const m = r.ref.match(/^(\d+):(\d+)(?:\s*[-–]\s*(\d+))?/);
    if (!book || !m) return [];
    const chapter = Number(m[1]);
    const from = Number(m[2]);
    const to = m[3] ? Number(m[3]) : from;
    if (to < from || to - from > MAX_RANGE) return [`${book.id}.${chapter}.${from}`];
    return Array.from({ length: to - from + 1 }, (_, i) => `${book.id}.${chapter}.${from + i}`);
};

/** Сравнение имён без оглядки на ё/й, регистр, дефисы и пробелы. */
export const normalizeName = (s: string) =>
    s.toLowerCase().replace(/ё/g, "е").replace(/й/g, "и").replace(/[^а-яa-z]/g, "");

// Согласный остов: гласные выпадают, согласные сводятся в классы по синодальной
// передаче еврейских имён через греческий. th, ph, p дают «ф» (Beth → Беф, Peor →
// Фегор), b и w — «в» (Bethel → Вефиль), k, c, q, g — одна задненёбная (Gilgal →
// Галгал), sh, s, tz — одна свистящая (Shechem → Сихем).
//
// ПРИДЫХАНИЕ НЕОБЯЗАТЕЛЬНО. Еврейское h передаётся то «х» (Chebar → Хевар), то никак
// (Hamath → Емаф), то наоборот пропадает в английском (Helkath → Хелкаф). Поэтому
// оно получает свой класс H и перед сравнением выбрасывается с обеих сторон.
const EN_RULES: [RegExp, string][] = [
    [/th|ph/g, "F"], [/sh|tz|ts|s|z|x/g, "S"], [/ch|kh|h/g, "H"], [/k|c|q|g/g, "K"], [/b|v|w/g, "B"],
    [/f|p/g, "F"], [/d/g, "D"], [/t/g, "T"], [/l/g, "L"], [/m/g, "M"], [/n/g, "N"], [/r/g, "R"],
];
const RU_MAP: Record<string, string> = {
    ф: "F", п: "F", с: "S", з: "S", ш: "S", щ: "S", ц: "S", ж: "S", к: "K", г: "K", х: "H",
    б: "B", в: "B", д: "D", т: "T", л: "L", м: "M", н: "N", р: "R",
};

export const skeleton = (name: string): string => {
    const s = name.toLowerCase();
    if (/[а-яё]/.test(s)) return [...s].map((c) => RU_MAP[c] ?? "").join("");
    let out = s.replace(/[^a-z]/g, "");
    for (const [re, cls] of EN_RULES) out = out.replace(re, cls);
    return out.replace(/[a-z]/g, "");
};

export const withoutAspiration = (s: string) => s.replace(/H/g, "");

const levenshtein = (a: string, b: string) => {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let prev = row[0];
        row[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const tmp = row[j];
            row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
            prev = tmp;
        }
    }
    return row[b.length];
};

/** Созвучие латинского и русского имени: остовы от двух согласных, начало общее, расхождение не больше одной на четыре. */
export const soundsAlike = (latin: string, russian: string): boolean => {
    const a = withoutAspiration(skeleton(latin)), b = withoutAspiration(skeleton(russian));
    if (a.length < 2 || b.length < 2 || a[0] !== b[0]) return false;
    return levenshtein(a, b) <= Math.floor(Math.max(a.length, b.length) / 4);
};

export interface ArticleInfo { alias: string; headword: string; keys: Set<string> }
export interface PlaceInfo {
    id: string;
    keys: Set<string>;
    /** Русские имена места (кроме взятых из энциклопедии). */
    ruNames: string[];
    /** Латинские имена из OpenBible — для созвучия. */
    latinNames?: string[];
}
export interface Match {
    placeId: string;
    alias: string;
    overlap: number;
    via: "wikidata" | "verses";
    decision: "auto" | "pending";
    reason: string;
}

/** Части заглавного слова: «Киринеи, Киринеянин, Кирены» — три формы. */
export const headwordForms = (headword: string) => headword.split(/\s*[,;]\s*/).filter(Boolean);

export const nameMatches = (place: PlaceInfo, article: ArticleInfo): "same" | "alike" | null => {
    const forms = headwordForms(article.headword);
    if (forms.some((f) => place.ruNames.some((n) => normalizeName(n) === normalizeName(f)))) return "same";
    if (forms.some((f) => (place.latinNames ?? []).some((n) => soundsAlike(n, f)))) return "alike";
    return null;
};

/** Сопоставление по стихам для мест и статей, не сведённых через Wikidata. */
export const matchByVerses = (articles: ArticleInfo[], places: PlaceInfo[]): Match[] => {
    const byKey = new Map<string, ArticleInfo[]>();
    for (const a of articles) for (const k of a.keys) {
        if (!byKey.has(k)) byKey.set(k, []);
        byKey.get(k)!.push(a);
    }

    // Для каждого места — перекрытие со всеми статьями, где есть хоть один общий стих.
    const scores = new Map<string, Map<string, number>>(); // placeId → alias → overlap
    for (const p of places) {
        const counts = new Map<string, number>();
        for (const k of p.keys) for (const a of byKey.get(k) ?? []) counts.set(a.alias, (counts.get(a.alias) ?? 0) + 1);
        if (counts.size) scores.set(p.id, counts);
    }
    const bestPlaceOfArticle = new Map<string, { placeId: string; overlap: number }>();
    for (const [placeId, counts] of scores) for (const [alias, overlap] of counts) {
        const prev = bestPlaceOfArticle.get(alias);
        if (!prev || overlap > prev.overlap) bestPlaceOfArticle.set(alias, { placeId, overlap });
    }

    const articleByAlias = new Map(articles.map((a) => [a.alias, a]));
    const matches: Match[] = [];
    for (const p of places) {
        const counts = scores.get(p.id);
        if (!counts) continue;
        const ranked = [...counts].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));

        // Созвучная статья среди делящих стих — сильнее перекрытия.
        const named = ranked
            .map(([alias, overlap]) => ({ alias, overlap, kind: nameMatches(p, articleByAlias.get(alias)!) }))
            .filter((c) => c.kind);
        if (named.length) {
            const [top, next] = named;
            if (!next || next.overlap < top.overlap) {
                matches.push({ placeId: p.id, alias: top.alias, overlap: top.overlap, via: "verses", decision: "auto",
                    reason: `${top.kind === "same" ? "имя совпало" : "имя созвучно"}, общих стихов ${top.overlap}` });
            } else {
                matches.push({ placeId: p.id, alias: top.alias, overlap: top.overlap, via: "verses", decision: "pending",
                    reason: `имя подходит у нескольких статей с равным числом общих стихов (${top.overlap})` });
            }
            continue;
        }

        const [alias, overlap] = ranked[0];
        const second = ranked[1]?.[1] ?? 0;
        const mutual = bestPlaceOfArticle.get(alias)?.placeId === p.id && second < overlap;
        if (mutual && overlap >= 3 && second <= overlap / 2) {
            matches.push({ placeId: p.id, alias, overlap, via: "verses", decision: "auto", reason: `взаимно лучшая пара, общих стихов ${overlap}, у второго ${second}` });
        } else if (mutual && overlap >= 2) {
            matches.push({ placeId: p.id, alias, overlap, via: "verses", decision: "pending", reason: `взаимно лучшая пара, но общих стихов ${overlap} при втором ${second}, имя не созвучно` });
        }
    }
    return matches;
};

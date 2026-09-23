// «Азбука паломника» (azbyka.ru/palomnik) как источник постоянных святынь —
// чистая часть: разбор викитекста страницы храма или обители. Сеть и запись —
// в src/scripts/import-azbyka-relics.ts.
//
// ПОЧЕМУ ОНА. У её страниц есть то, чего нет ни у сайтов приходов, ни у
// открытых данных, — раздел «Святыни» списком: «Мощи прп. Сергия
// Радонежского (в Троицком соборе)», и шаблон с координатами. То есть готовая
// стыковка «храм — святыня — где именно», а ссылка на страницу служит
// подтверждением. Это вики, и страницы берутся её собственным API пачками по
// пятьдесят, без обхода вёрстки.
//
// ЧТО ОНА НЕ ДАЁТ. Принесённое на время там не пишут: раздел описывает
// постоянное. Временное — дело обходчика новостей приходов.
//
// Берём факт и ссылку, а не текст: «в таком-то храме мощи такого-то» — сведение,
// а не чужое сочинение; сама статья остаётся у них, мы на неё ссылаемся.

import { mentionsOf, saintsInLine, type GuessKind } from "./crawl";

export const AZBYKA_BASE = "https://azbyka.ru/palomnik/";
export const AZBYKA_API = `${AZBYKA_BASE}api.php`;

/** Категории, из которых берём страницы: храмы и обители — у них есть раздел «Святыни». */
export const AZBYKA_CATEGORIES = ["Категория:Россия (Монастыри)", "Категория:Россия (Приходские храмы)"];

export const pageUrl = (title: string) => AZBYKA_BASE + encodeURIComponent(title.replace(/ /g, "_"))
    .replace(/%2F/g, "/").replace(/%3A/g, ":").replace(/%28/g, "(").replace(/%29/g, ")");

/** Точка из шаблона «Местоположение святыни»: «локация=55.705056, 37.361645». */
export const locationOf = (wikitext: string): { lat: number; lon: number } | null => {
    const m = /\{\{\s*Местоположение[^}]*?локация\s*=\s*(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)/i.exec(wikitext);
    if (!m) return null;
    const lat = Number(m[1]);
    const lon = Number(m[2]);
    return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && (lat !== 0 || lon !== 0) ? { lat, lon } : null;
};

/** Вид места из того же шаблона: «Приходской храм», «Монастырь». */
export const placeKindOf = (wikitext: string): string | null =>
    /\{\{\s*Местоположение[^}]*?вид\s*=\s*([^|}]+)/i.exec(wikitext)?.[1].trim() ?? null;

/** Разметка вики — в текст: ссылки подписью, без жирного, без мягких переносов. */
export const unwiki = (s: string) => s
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, "$1")
    .replace(/\[https?:\/\/\S+\]/g, "")
    .replace(/'{2,}/g, "")
    .replace(/<ref[\s\S]*?(<\/ref>|\/>)/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/­/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Текст раздела «Святыни» — до следующего заголовка того же или старшего уровня. */
export const shrinesSection = (wikitext: string): string | null => {
    const m = /^(={2,})\s*Святыни\s*\1\s*$/m.exec(wikitext);
    if (!m) return null;
    const level = m[1].length;
    const rest = wikitext.slice((m.index ?? 0) + m[0].length);
    const next = new RegExp(`^={2,${level}}[^=].*?={2,${level}}\\s*$`, "m").exec(rest);
    return next ? rest.slice(0, next.index) : rest;
};

export interface AzbykaRelic {
    /** Строка списка как она есть, без разметки: её видит разбирающий. */
    line: string;
    kind: GuessKind;
    /** «святителя Николая Чудотворца» — в родительном падеже, как в строке. */
    saintGuess: string | null;
    /** Уточнение в скобках: «в Троицком соборе», «глава», «десница». */
    where: string | null;
    /** В строке сказано о прошлом — «до революции хранилась», «перенесены в…». */
    former: boolean;
    /** Общие прозвания строки — подсказка к выбору святого среди тёзок. */
    context: string;
}

/**
 * Не мощи, хотя рядом с ними: миро и масло от мощей, вата, земля. Святыни, но
 * реестр — о мощах и их частях.
 */
const NOT_RELIC = /^(?:св\.?\s*|святое\s+)?(?:миро|масло|елей|часть\s+мира|вата|земл[яи]|песок)|(?:миро|масло|елей)\s+(?:с|от)\s+(?:св\.?\s*)?мощ/i;

const FORMER = /(хранил[аи]сь|находил[аи]сь|покоил[аи]сь|почивал[аи]|были\s+перенесены|перенесены\s+в|утрачен|до\s+революции|до\s+\d{4})/i;

/**
 * Святыни-мощи из раздела: строка списка с «мощи», «частица», «глава», «ковчег»,
 * «мощевик». Иконы, источники и могилы — тоже святыни, но не этого реестра.
 */
export const relicsOf = (wikitext: string): AzbykaRelic[] => {
    const section = shrinesSection(wikitext);
    if (!section) return [];
    const out: AzbykaRelic[] = [];
    for (const raw of section.split("\n")) {
        if (!/^\s*[*#]/.test(raw)) continue;
        const line = unwiki(raw.replace(/^\s*[*#]+\s*/, ""));
        if (!/(мощ|ковчег|глав[аы]\s|десниц|стопа)/i.test(line)) continue;
        // Сокращения званий («прп.», «свт.», «вмч.») раскрывает сам разбор
        // упоминаний; здесь только снимаем скобки, чтобы святой не слипся с местом.
        const where = /\(([^()]*)\)\s*$/.exec(line)?.[1].trim() ?? null;
        const body = where ? line.slice(0, line.lastIndexOf("(")).trim() : line;
        if (NOT_RELIC.test(body)) continue;
        const [mention] = mentionsOf(body, null);
        const kind = mention?.kind ?? (/глав/i.test(body) ? "glava" : "moshchi");
        const former = FORMER.test(line);
        // Святых в строке бывает несколько — каждый становится своей находкой:
        // запись реестра — один святой в одном храме.
        const saints = saintsInLine(body);
        if (saints.length) {
            for (const s of saints) out.push({ line, kind, saintGuess: s.guess, where, former, context: s.context });
        } else {
            out.push({ line, kind, saintGuess: mention?.saintGuess ?? null, where, former, context: "" });
        }
    }
    return out;
};

/**
 * Храм обители, названный в уточнении: «в Троицком соборе» → основа «троицк».
 * По ней среди храмов у точки выбирается нужный, а не ближайший к середине
 * монастыря.
 */
export const whereStems = (where: string | null): string[] =>
    (where ?? "")
        .toLowerCase().replace(/ё/g, "е")
        .replace(/^(в|во|на)\s+/, "")
        .split(/[^а-я]+/)
        .filter((w) => w.length >= 4 && !/^(храм|церк|собор|часовн|палат|ризниц|приде|монаст|обител|левом|правом|южн|северн|раке|раку)/.test(w))
        .map((w) => w.replace(/(ого|его|ой|ей|ом|ем|ая|ый|ий|ых|их)$/, ""))
        .filter((w) => w.length >= 4);

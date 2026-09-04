// Виджет чтений: страница на чужом сайте.
//
// ОТДАЁМ СТРАНИЦУ, А НЕ СКРИПТ. Приходский сайт вставляет `<iframe>`, и всё
// рисуется у нас. Так решаются разом три задачи, которые скриптом решались бы
// каждая по отдельности: не нужен ключ и не тратится порция публичного API
// (запрос идёт не из браузера посетителя, а к нашей же странице); стили чужого
// сайта не дерутся с нашими и наоборот; на чужую страницу не приезжает ни
// нашего JavaScript, ни нашего бандла. Цена — рамка, которую нельзя оформить
// снаружи, и оттого настройки вида вынесены в параметры адреса.
//
// РАЗМЕТКА СОБИРАЕТСЯ СТРОКОЙ, без React и без Tailwind: виджет должен весить
// килобайты, а не сотни килобайт. Отсюда же и главная опасность — экранировать
// приходится РУКАМИ, и всякое поле, пришедшее из базы, обязано пройти `esc`.
// Пропущенное поле — дыра не у нас, а на чужом сайте, и потому проверено
// тестом.

/** Всё, что приходит из базы, проходит через это. Без исключений. */
export const esc = (raw: unknown): string =>
    String(raw ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

export type Theme = "light" | "dark" | "auto";
export type Part = "memory" | "readings";

export interface EmbedOptions {
    /** Гражданская дата дня. */
    date: string;
    /** Издание Библии, в котором разрешаются зачала. */
    lang: string;
    /** Что показывать. Пустого набора не бывает: виджет без содержимого не виджет. */
    parts: Part[];
    theme: Theme;
    /** Заголовок над блоком; пусто — без заголовка. */
    title: string | null;
    /** Делать ли цитаты ссылками на сайт. */
    links: boolean;
    /** Только библейские чтения или все, включая книжные. */
    only: "all" | "bible";
}

export const DEFAULT_PARTS: Part[] = ["memory", "readings"];

const KNOWN_PARTS: Part[] = ["memory", "readings"];
const KNOWN_THEMES: Theme[] = ["light", "dark", "auto"];

/**
 * Разбор параметров адреса.
 *
 * Неизвестное значение не ошибка, а умолчание: виджет стоит на чужом сайте,
 * и уронить его опечаткой в параметре — значит оставить приход с пустой
 * рамкой вместо чтений. Ошибку покажет сборщик виджета, а не посетитель.
 */
export const readOptions = (params: URLSearchParams, today: string): EmbedOptions => {
    const date = params.get("date");
    const parts = (params.get("parts") ?? "")
        .split(",")
        .map(p => p.trim())
        .filter((p): p is Part => (KNOWN_PARTS as string[]).includes(p));
    const theme = params.get("theme");
    const title = params.get("title");

    return {
        date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today,
        lang: params.get("lang") || "cs",
        parts: parts.length ? parts : DEFAULT_PARTS,
        theme: KNOWN_THEMES.includes(theme as Theme) ? (theme as Theme) : "light",
        // «title=0» — сознательный отказ от заголовка, пустой параметр — тоже.
        title: title === null ? "Чтения дня" : (title === "0" || title === "" ? null : title),
        links: params.get("links") !== "0",
        only: params.get("only") === "bible" ? "bible" : "all",
    };
};

export interface EmbedReading {
    slot: string;
    cites: Array<{ cite: string; alias: string | null; bible: boolean }>;
}

/**
 * Длина имени в рамке.
 *
 * Библейское чтение зовётся коротко — «Быт. 4:16–26», — а книжное целым
 * заголовком: «Ме́сяца того́же, в 19 день. Па́мять святы́х апо́стол Архи́ппа, и
 * Филимо́на…». В рамке шириной с приходскую колонку такой заголовок съедает
 * четыре строки и вытесняет собою всё остальное. Обрезаем по слову.
 */
export const CITE_MAX = 58;

export const shorten = (raw: string, max = CITE_MAX): string => {
    const text = raw.trim();
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const space = cut.lastIndexOf(" ");
    return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[,.;:]$/, "")}…`;
};

export interface EmbedDay {
    /** «4 марта 2026, среда» — гражданская дата словами. */
    dateLabel: string;
    /** «19 февраля по старому стилю» — церковная. */
    churchLabel: string | null;
    /** Название дня подвижного круга, если он есть. */
    dayName: string | null;
    memories: Array<{ name: string; sign: string | null }>;
    readings: EmbedReading[];
}

// Цвета заданы переменными, чтобы тёмная тема была подменой четырёх значений,
// а не второй копией стилей. `auto` слушает системную настройку читателя:
// на тёмном сайте виджет со светлым нутром выглядит заплатой.
const PALETTE = {
    light: { bg: "#ffffff", fg: "#0f172a", muted: "#64748b", rule: "#e2e8f0", link: "#7f1d1d" },
    dark: { bg: "#0f172a", fg: "#e2e8f0", muted: "#94a3b8", rule: "#334155", link: "#fca5a5" },
};

const vars = (t: typeof PALETTE.light) =>
    `--bg:${t.bg};--fg:${t.fg};--muted:${t.muted};--rule:${t.rule};--link:${t.link}`;

export const styles = (theme: Theme): string => `
:root{${vars(PALETTE.light)}}
${theme === "dark" ? `:root{${vars(PALETTE.dark)}}` : ""}
${theme === "auto" ? `@media (prefers-color-scheme: dark){:root{${vars(PALETTE.dark)}}}` : ""}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);
     font:15px/1.45 Georgia,"Times New Roman",serif;padding:10px 12px}
a{color:var(--link);text-decoration:none}
a:hover{text-decoration:underline}
.t{font-weight:700;margin:0 0 6px}
.d{color:var(--muted);font-size:13px;margin-bottom:6px}
.m{margin:0 0 8px}
.m span{color:var(--muted);font-size:13px}
.r{list-style:none;margin:0;padding:0}
.r li{padding:3px 0;border-top:1px solid var(--rule)}
.r .s{color:var(--muted);font-size:13px;display:block}
.f{margin-top:10px;padding-top:6px;border-top:1px solid var(--rule);
   color:var(--muted);font-size:12px}
`.trim();

const memoryLine = (day: EmbedDay): string => {
    if (!day.memories.length) return "";
    const [first, ...rest] = day.memories;
    const others = rest.length
        ? ` <span>${rest.map(m => esc(m.name)).join("; ")}</span>`
        : "";
    return `<p class="m">${esc(first.name)}${others}</p>`;
};

const readingLine = (reading: EmbedReading, links: boolean, base: string): string => {
    const cites = reading.cites.map(c => {
        const label = esc(shorten(c.cite));
        return links && c.alias
            ? `<a href="${base}/reading/${esc(c.alias)}" target="_blank" rel="noopener">${label}</a>`
            : label;
    });
    return `<li><span class="s">${esc(reading.slot)}</span>${cites.join(", ")}</li>`;
};

/** Отбор чтений: «только библейские» — это про зачала, а не про книги. */
export const pickReadings = (readings: EmbedReading[], only: EmbedOptions["only"]): EmbedReading[] =>
    only === "all" ? readings : readings
        .map(r => ({ ...r, cites: r.cites.filter(c => c.bible) }))
        .filter(r => r.cites.length);

/**
 * Готовая страница виджета.
 *
 * `base` — адрес сайта: ссылки наружу должны вести на нас и открываться новой
 * вкладкой, иначе переход уведёт посетителя из рамки внутри чужой страницы.
 *
 * ВНУТРИ ЭТОЙ СТРОКИ НЕТ ОБРАТНЫХ КАВЫЧЕК — ни в разметке, ни в скрипте, ни
 * даже в комментарии к нему: строка сама шаблонная, и первая же такая кавычка
 * обрывает её, а сборка падает разбором в середине русского текста, где искать
 * причину меньше всего хочется. Проверено на себе.
 */
export const renderEmbed = (
    day: EmbedDay | null, options: EmbedOptions, base: string,
): string => {
    const head = [
        options.title ? `<p class="t">${esc(options.title)}</p>` : "",
        `<p class="d">${esc(day?.dateLabel ?? options.date)}`
        + (day?.churchLabel ? ` · ${esc(day.churchLabel)}` : "")
        + (day?.dayName ? ` · ${esc(day.dayName)}` : "")
        + `</p>`,
    ].join("");

    const body = !day
        // Пустая рамка на чужом сайте выглядит поломкой этого сайта, а не
        // нашей: сказать, что случилось, — меньшее, чем мы обязаны приходу.
        ? `<p class="m">Чтения на этот день сейчас недоступны.</p>`
        : [
            options.parts.includes("memory") ? memoryLine(day) : "",
            options.parts.includes("readings") && pickReadings(day.readings, options.only).length
                ? `<ul class="r">${pickReadings(day.readings, options.only)
                    .map(r => readingLine(r, options.links, base)).join("")}</ul>`
                : "",
        ].join("");

    const dayHref = `${base}/calculator/${esc(options.date)}`;

    return `<!doctype html>
<html lang="ru"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(options.title ?? "Чтения дня")}</title>
<style>${styles(options.theme)}</style>
</head><body>
${head}${body}
<p class="f"><a href="${dayHref}" target="_blank" rel="noopener">Уставные чтения</a> — устав, чтения и календарь</p>
<script>
// Рамке снаружи не видно, какой она высоты, и хозяин сайта вынужден был бы
// подбирать её руками под самый длинный день. Сообщаем свою высоту: кто
// подключил embed.js, тот получит рамку по содержимому, кто не подключил —
// ничего не заметит.
//
// ГОВОРИМ НЕСКОЛЬКО РАЗ, И НАРОЧНО. Слушатель на чужой странице подключается
// скриптом с признаком async — то есть когда придётся, и запросто позже нас.
// Сказав свою высоту единожды, мы говорили бы её в пустоту, и рамка осталась
// бы той, что вписана руками. Повтор стоит одно сообщение, а молчание —
// сломанного вида на чужом сайте.
(function(){function s(){parent.postMessage({typikon:"height",
height:document.documentElement.scrollHeight},"*");}
s();addEventListener("load",s);addEventListener("resize",s);
[100,400,1200].forEach(function(ms){setTimeout(s,ms);});
if(window.ResizeObserver){new ResizeObserver(s).observe(document.documentElement);}})();
</script>
</body></html>`;
};

import { getDneslovMemory, getDneslovImage, DneslovEvent } from "@/scripts/lib/dneslov";
import { extractHeroFromHeuristic, HeroName } from "@/scripts/lib/heroName";
import { expandOrderAbbreviation } from "@/scripts/lib/orderAbbreviations";
import { ChannelPostNameSource } from "@/types/dto/channelPost";
import { saintImages, saintSlugs } from "@/lib/saints";

interface DaySongText {
    _id: string;
    name: string;
    alias: string;
    ruLink?: string | null;
    dneslovId?: string | null;
    dneslovEventId?: string | null;
    poems?: string | null;
    content?: string | null;
}

interface DaySongItem {
    text: DaySongText;
}

interface DayWithMonth {
    month?: { value: number };
    monthIndex?: number;
}

export interface BuiltChannelPost {
    text: string;
    imageUrl: string | null;
    hashtags: string[];
    nameSource: ChannelPostNameSource;
    sourceTextId: string;
    sourceTextName: string;
    dneslovId: string | null;
    dneslovSlug: string | null;
}

const SITE = "https://www.typikon.su";
const HELP_LINK = "https://messenger.online.sberbank.ru/sl/8xVnkqtrmfkJzj8yO";
const TELEGRAM_LIMIT = 4096;
const BODY_LIMIT = 3200; // запас под заголовок/стихи/ссылки/хэштеги в лимите Telegram

// Русские названия месяцев в родительном падеже — для "(29 июля)". Нигде в проекте такого
// уже нет: get MonthLabel в @/lib/common/date возвращает именительный ("Июль").
const MONTHS_GENITIVE = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

const escapeHtml = (value?: string | null): string =>
    String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

const formatOldStyleDate = (day: DayWithMonth): string => {
    const monthName = MONTHS_GENITIVE[(day?.month?.value || 1) - 1];
    return `${day?.monthIndex ?? ""} ${monthName}`.trim();
};

// В разметке текстов святой обозначен номером святцев: {st|102|Златоуст}. Адрес страницы
// с 2026-08-31 — наш слуг, а номер уводит редиректом; поэтому номера в ссылку не ставим,
// а сперва переводим в адреса. Опубликованный пост живёт в канале вечно, и ссылка в нём
// должна вести куда надо сразу, а не через переброс, который однажды может и не пережить
// очередной правки маршрутов.
const SAINT_MARKER = /\{st\|([^|}]+)\|([^}]+)\}/g;

/** Номера святцев, помянутые в разметке, — чтобы разрешить их адреса одним запросом. */
const saintIdsIn = (content: string): string[] =>
    [...content.matchAll(SAINT_MARKER)].map((m) => String(m[1]).trim()).filter(Boolean);

// {st|id|Имя} -> ссылка на святого, {pl|id|Имя} -> ссылка на место, {k|текст} -> выделение
// (замена киновари, в Telegram нет цвета), {123} / note_123# -> убираем — это ссылки на
// сноски/личные заметки, без соответствующей панели в посте они бессмысленны.
const markupToTelegramHtml = (paragraph: string, saintAddresses: Record<string, string> = {}): string =>
    escapeHtml(paragraph)
        .replace(SAINT_MARKER, (_, id, label) => {
            const key = String(id).trim();
            // Памяти, которой нет в каталоге, оставляем номер: страница по нему работает.
            return `<a href="${SITE}/saints/${saintAddresses[key] ?? key}">${label}</a>`;
        })
        .replace(/\{pl\|([^|}]+)\|([^}]+)\}/g, (_, id, label) => `<a href="${SITE}/places/${id}">${label}</a>`)
        .replace(/\{k\|([^}]+)\}/g, (_, text) => `<b>${text}</b>`)
        .replace(/\{\d+\}/g, "")
        .replace(/note_\d+#/g, "");

const truncateBody = (html: string): { html: string; truncated: boolean } => {
    if (html.length <= BODY_LIMIT) {
        return { html, truncated: false };
    }
    const cut = html.slice(0, BODY_LIMIT);
    const safeCut = cut.slice(0, cut.lastIndexOf(" "));
    return { html: `${safeCut}…`, truncated: true };
};

// Реальная форма ответа Днеслова (проверено на живых данных, см. dneslov.ts): чистое имя —
// в top-level short_name/gallery_title ("Стефа́н Первому́ченик"). Чин — в events[].memoes[].orders,
// карта вида {"ап":"мч","мч":"мч"}: самореферентная запись (ключ === значению) — каноническое
// сокращение чина для этой памяти. Событие выбираем по dneslovEventId, если он есть, иначе первое.
// Берём канонические сокращения по ВСЕМ memoes события (не только первому) — у одной памяти
// может быть несколько справедливых чинов одновременно (например Стефан — "ап" и "мч" сразу,
// он в лике семидесяти апостолов, но чтится в первую очередь как первомученик). Выбирать между
// ними произвольно не хотим — отдаём оба, это только увеличивает шанс найти пост по хэштегу.
const findCanonicalOrderAbbreviations = (event?: DneslovEvent): string[] => {
    const abbreviations = new Set<string>();
    for (const memo of event?.memoes || []) {
        if (!memo.orders) continue;
        const selfMapped = Object.entries(memo.orders).find(([abbr, canonical]) => abbr === canonical);
        if (selfMapped) abbreviations.add(selfMapped[0]);
    }
    return [...abbreviations];
};

const resolveHero = async (text: DaySongText): Promise<{ hero: HeroName | null; dneslovSlug: string | null }> => {
    const heuristic = extractHeroFromHeuristic(text.name);

    if (!text.dneslovId) {
        return { hero: heuristic, dneslovSlug: null };
    }

    const memory = await getDneslovMemory(text.dneslovId);
    if (!memory) {
        console.warn(`dneslov: память для dneslovId=${text.dneslovId} не получена`);
        return { hero: heuristic, dneslovSlug: null };
    }

    const name = (memory.short_name || memory.gallery_title || "").trim();
    if (!name) {
        console.warn(`dneslov: у памяти dneslovId=${text.dneslovId} нет short_name/gallery_title:`, JSON.stringify(memory).slice(0, 300));
        return { hero: heuristic, dneslovSlug: memory.slug ?? null };
    }

    const event =
        memory.events?.find((e) => !text.dneslovEventId || String(e.id) === text.dneslovEventId) ||
        memory.events?.[0];
    const orderAbbreviations = findCanonicalOrderAbbreviations(event);

    return {
        hero: {
            name,
            ranks: orderAbbreviations.length ? orderAbbreviations.map(expandOrderAbbreviation) : heuristic?.ranks ?? [],
            source: "dneslov",
        },
        dneslovSlug: memory.slug ?? null,
    };
};

export const buildChannelPost = async ({
    day,
    item,
    dayAlias,
}: {
    day: DayWithMonth;
    item: DaySongItem;
    dayAlias: string;
}): Promise<BuiltChannelPost> => {
    const text = item.text;

    const content = text.content || "";
    const saintAddresses = await saintSlugs(saintIdsIn(content));
    const paragraphs = content.split("\n\n").map((paragraph) => markupToTelegramHtml(paragraph, saintAddresses));
    const { html: bodyHtml, truncated } = truncateBody(paragraphs.join("\n\n"));

    const poemsBlock = text.poems ? `<b>Стихи́:</b>\n${escapeHtml(text.poems)}` : "";

    const { hero, dneslovSlug } = await resolveHero(text);
    // Картинка поста: сперва свой снимок, сеть — запасным путём. Прежде этот запрос
    // уходил в святцы на каждый собираемый пост и при их недоступности оставлял пост
    // без картинки (замер 2026-08-31: таймаут на 10 секундах).
    //
    // РАЗНИЦА, О КОТОРОЙ СТОИТ ЗНАТЬ: снимок хранит изображения памяти целиком, без
    // разбивки по событиям, а сетевой путь умеет спрашивать конкретное событие
    // (dneslovEventId). Берём первое, как брал и он, но у памяти с несколькими
    // событиями это может быть не та же картинка, что раньше.
    const imageUrl = text.dneslovId
        ? ((await saintImages(text.dneslovId))?.[0]?.url
            ?? await getDneslovImage(text.dneslovId, text.dneslovEventId))
        : null;

    // normalize+strip диакритику (Днеслов пишет с ударениями: "Стефа́н") — иначе значок ударения
    // остаётся в хэштеге как отдельный символ.
    const toHashtag = (w: string) =>
        `#${w.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s,.;:!?]/g, "")}`;
    // Имя разбиваем на отдельные хэштеги по словам ("Стефан Первомученик" -> #Стефан #Первомученик) —
    // по одному слову искать вероятнее, чем по слитному "#СтефанПервомученик". Чисто цифровые
    // токены (например "9" из "9 мучеников Пергийских") в хэштег не превращаем — по ним не ищут.
    const nameWords = hero?.name
        ? hero.name.split(/\s+/).filter((w) => /[А-Яа-яЁё]/.test(w))
        : [];
    const hashtags = [...nameWords, ...(hero?.ranks || [])].map(toHashtag);
    hashtags.push("#Пролог");

    const csLabel = truncated ? "Полный церковнославянский текст" : "Церковнославянский текст";

    const headerBlock = `<b>ПРОЛОГ на день (${formatOldStyleDate(day)})</b>\n${escapeHtml(text.name)}`;
    const linksBlock = [
        `<a href="${SITE}/reading/${text.alias}">${csLabel}</a>`,
        text.ruLink ? `<a href="${text.ruLink}">Русский текст</a>` : "",
        `<a href="${SITE}/calendar/${dayAlias}">Чтения на день</a>`,
    ]
        .filter((l) => l !== "")
        .join("\n");

    // Каждый блок — законченная смысловая часть (может быть в несколько строк внутри себя).
    // Между блоками — ровно одна пустая строка; блоки, которых нет (например нет стихов),
    // просто отсутствуют в массиве, а не превращаются в пустую строку, которую потом
    // приходится вычищать регуляркой (раньше так терялся перенос перед "Стихи́:").
    const blocks = [
        headerBlock,
        poemsBlock,
        bodyHtml,
        linksBlock,
        hashtags.join(" "),
        `<a href="${HELP_LINK}">Помочь проекту</a>`,
    ].filter((b) => b !== "");

    let fullText = blocks.join("\n\n").trim();

    if (fullText.length > TELEGRAM_LIMIT) {
        fullText = `${fullText.slice(0, TELEGRAM_LIMIT - 1)}…`;
    }

    return {
        text: fullText,
        imageUrl,
        hashtags,
        nameSource: hero?.source || "none",
        sourceTextId: text._id,
        sourceTextName: text.name,
        dneslovId: text.dneslovId || null,
        dneslovSlug,
    };
};

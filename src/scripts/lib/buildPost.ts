import { getDneslovMemory, getDneslovImage } from "@/scripts/lib/dneslov";
import { extractHeroFromDneslovTitle, extractHeroFromHeuristic, HeroName } from "@/scripts/lib/heroName";
import { ChannelPostNameSource } from "@/types/dto/channelPost";

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

// {st|id|Имя} -> ссылка на святого, {pl|id|Имя} -> ссылка на место, {k|текст} -> выделение
// (замена киновари, в Telegram нет цвета), {123} / note_123# -> убираем — это ссылки на
// сноски/личные заметки, без соответствующей панели в посте они бессмысленны.
const markupToTelegramHtml = (paragraph: string): string =>
    escapeHtml(paragraph)
        .replace(/\{st\|([^|}]+)\|([^}]+)\}/g, (_, id, label) => `<a href="${SITE}/saints/${id}">${label}</a>`)
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

const resolveHero = async (text: DaySongText): Promise<{ hero: HeroName | null; dneslovSlug: string | null }> => {
    if (text.dneslovId) {
        const memory = await getDneslovMemory(text.dneslovId);
        if (!memory) {
            console.warn(`dneslov: память для dneslovId=${text.dneslovId} не получена`);
        }
        const memo =
            memory?.memoes?.find((m) => !text.dneslovEventId || m.eventId === text.dneslovEventId) ||
            memory?.memoes?.[0];
        if (memory && !memo) {
            console.warn(`dneslov: у памяти dneslovId=${text.dneslovId} нет memoes:`, JSON.stringify(memory).slice(0, 300));
        }
        const hero = extractHeroFromDneslovTitle(memo?.title);
        if (hero) return { hero, dneslovSlug: memory?.slug ?? null };
        if (memo?.title) {
            console.warn(`dneslov: не удалось разобрать чин/имя из заголовка "${memo.title}" — использую эвристику`);
        }
        return { hero: extractHeroFromHeuristic(text.name), dneslovSlug: memory?.slug ?? null };
    }
    return { hero: extractHeroFromHeuristic(text.name), dneslovSlug: null };
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

    const paragraphs = (text.content || "").split("\n\n").map(markupToTelegramHtml);
    const { html: bodyHtml, truncated } = truncateBody(paragraphs.join("\n\n"));

    const poemsBlock = text.poems ? `<b>Стихи́:</b>\n${escapeHtml(text.poems)}\n\n` : "";

    const { hero, dneslovSlug } = await resolveHero(text);
    const imageUrl = text.dneslovId ? await getDneslovImage(text.dneslovId, text.dneslovEventId) : null;

    const hashtags = hero
        ? [hero.name, hero.rank].filter((v): v is string => !!v).map((w) => `#${w.replace(/[\s,.;:!?]/g, "")}`)
        : [];
    hashtags.push("#Пролог");

    const csLabel = truncated ? "Полный церковнославянский текст" : "Церковнославянский текст";

    const lines = [
        `<b>ПРОЛОГ на день (${formatOldStyleDate(day)})</b>`,
        escapeHtml(text.name),
        "",
        poemsBlock,
        bodyHtml,
        "",
        `<a href="${SITE}/reading/${text.alias}">${csLabel}</a>`,
        text.ruLink ? `<a href="${text.ruLink}">Русский текст</a>` : "",
        `<a href="${SITE}/calendar/${dayAlias}">Чтения на день</a>`,
        hashtags.join(" "),
        `<a href="${HELP_LINK}">Помочь проекту</a>`,
    ];

    let fullText = lines
        .filter((l) => l !== "")
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

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

// Новости: всё, что можно посчитать без базы.
//
// Вынесено отдельно от выборок ради тестов: адрес записи, отметка «новое» и сборка
// RSS — три места, где ошибка не падает, а тихо портит результат (битый адрес,
// вечно горящая точка в меню, непринятый читалкой фид).

const TRANSLIT: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
    й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
    у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
    э: "e", ю: "yu", я: "ya",
};

/**
 * Адрес записи из заголовка. Латиницей, а не кириллицей в процентах: такой адрес
 * можно продиктовать и вставить в письмо, не превратив его в частокол из %D0%.
 */
export const slugify = (title: string): string => {
    const slug = title
        .toLowerCase()
        .split("")
        .map((char) => (TRANSLIT[char] !== undefined ? TRANSLIT[char] : char))
        .join("")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60)
        .replace(/-+$/g, "");

    // Заголовок мог состоять из одних знаков препинания — адрес всё равно нужен.
    return slug || "novost";
};

/** Свободный адрес: занятый дополняется номером, а не молча перезаписывает чужую запись. */
export const uniqueAlias = (base: string, taken: readonly string[]): string => {
    if (!taken.includes(base)) return base;

    for (let i = 2; ; i++) {
        const candidate = `${base}-${i}`;
        if (!taken.includes(candidate)) return candidate;
    }
};

/**
 * Есть ли непрочитанное. Читатель, зашедший впервые, непрочитанного не имеет:
 * иначе точка в меню горела бы у всех и всегда и перестала бы что-либо значить.
 */
export const hasUnread = (latestPublishedAt: string | null, lastSeenAt: string | null): boolean => {
    if (!latestPublishedAt) return false;
    if (!lastSeenAt) return false;

    const latest = Date.parse(latestPublishedAt);
    const seen = Date.parse(lastSeenAt);

    if (Number.isNaN(latest)) return false;
    // Отметка испорчена (правили руками, старый формат) — считаем, что читатель новый.
    if (Number.isNaN(seen)) return false;

    return latest > seen;
};

const ESCAPES: Record<string, string> = {
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
};

/** XML не прощает сырых & и < — в заголовке новости они встречаются постоянно. */
export const escapeXml = (value: string): string => value.replace(/[&<>"']/g, (char) => ESCAPES[char]);

export interface FeedItem {
    alias: string;
    title: string;
    summary: string;
    publishedAt: string;
}

/**
 * RSS 2.0 — самый простой формат, который читают все читалки. Дата в формате RFC 822,
 * как того требует спецификация: ISO читалки понимают не все.
 */
export const rssXml = (items: FeedItem[], site: string): string => {
    const entries = items.map((item) => `        <item>
            <title>${escapeXml(item.title)}</title>
            <link>${escapeXml(`${site}/news/${item.alias}`)}</link>
            <guid isPermaLink="true">${escapeXml(`${site}/news/${item.alias}`)}</guid>
            <pubDate>${new Date(item.publishedAt).toUTCString()}</pubDate>
            <description>${escapeXml(item.summary)}</description>
        </item>`).join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
    <channel>
        <title>Уставные чтения — новости</title>
        <link>${escapeXml(`${site}/news`)}</link>
        <description>Что нового в корпусе уставных чтений и на сайте</description>
        <language>ru</language>
${entries}
    </channel>
</rss>
`;
};

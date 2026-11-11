import { SITE_URL, LEGACY_SITE_URL } from "@/utils/site";
import { CAPTION_LIMIT, LIMIT_MARGIN, truncateHtmlByWords, visibleLength } from "./postText";

interface CaptionInput {
    text: string;
    sourceTextId?: string | null;
}

const fullTextUrl = (post: CaptionInput): string | null => {
    if (post.sourceTextId && /^[a-f\d]{24}$/i.test(String(post.sourceTextId))) {
        return `${SITE_URL}/reading/${post.sourceTextId}`;
    }
    // У вручную созданного поста источник может быть указан ссылкой в самом тексте.
    for (const match of post.text.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1/gi)) {
        try {
            const url = new URL(match[2].replace(/&amp;/g, "&"), SITE_URL);
            if ([SITE_URL, LEGACY_SITE_URL].includes(url.origin) && /^\/reading\/[^/]+\/?$/.test(url.pathname)) {
                return `${SITE_URL}${url.pathname}${url.search}${url.hash}`;
            }
        } catch { /* Остальные ссылки не являются ссылкой на исходный текст. */ }
    }
    return null;
};

/** Исходный текст в админке не изменяется — сокращается только подпись при отправке. */
export const photoCaption = (post: CaptionInput): string => {
    if (visibleLength(post.text) <= CAPTION_LIMIT) return post.text;
    const url = fullTextUrl(post);
    if (!url) {
        throw new Error('Для сокращения поста добавьте ссылку на полную версию на сайте: <a href="https://www.typikon.info/reading/…">Полный текст</a>.');
    }
    const escapedUrl = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const footer = `\n\n<a href="${escapedUrl}">Читать полностью на сайте</a>`;
    // Многоточие занимает один знак сверх бюджета truncateHtmlByWords.
    const budget = CAPTION_LIMIT - LIMIT_MARGIN - visibleLength(footer) - 1;
    return truncateHtmlByWords(post.text, budget).html + footer;
};

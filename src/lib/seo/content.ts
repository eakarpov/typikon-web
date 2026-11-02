import { SITE_URL } from "@/utils/site";
import { bookCategoryLabel, bookPresentation } from "@/utils/libraryBooks";
import { canonicalPath } from "@/lib/contentAliases";
import { isoDate, seoText, schemaLanguage } from "./metadata";

type ContentDocument = {
    id?: string; alias?: string; name?: string; description?: string; content?: string;
    author?: string; language?: string; updatedAt?: unknown; category?: string;
    bookName?: string; bookLanguage?: string; bookAlias?: string; bookId?: unknown;
};

export function bookDescription(book: ContentDocument): string {
    if (book.description?.trim()) return seoText(book.description);
    return seoText([
        book.name, book.author && `Автор: ${book.author}`,
        book.category && `Тематика: ${bookCategoryLabel(book.category)}`,
        book.language && `${bookPresentation(book.language).label}, ${bookPresentation(book.language).scriptLabel.toLowerCase()} начертание`,
        "Оглавление и тексты для чтения онлайн",
    ].filter(Boolean).join(". ") + ".");
}

export function readingTitle(text: ContentDocument): string {
    return seoText([text.name || "Чтение", text.bookName].filter(Boolean).join(" — "), 140);
}

export function readingDescription(text: ContentDocument): string {
    return seoText(text.description || [
        text.name, text.author, text.bookName,
        seoText(text.content, 200) || "Текст готовится к публикации",
    ].filter(Boolean).join(". "));
}

export function contentSchema(section: "library" | "reading", item: ContentDocument, description: string) {
    return {
        "@context": "https://schema.org",
        "@type": section === "library" ? "Book" : "CreativeWork",
        "@id": `${SITE_URL}${canonicalPath(section, item)}#work`,
        url: `${SITE_URL}${canonicalPath(section, item)}`,
        name: seoText(item.name, 140),
        description,
        ...(item.author && !/разные|неизвестн/i.test(item.author) ? { author: { "@type": "Person", name: seoText(item.author) } } : {}),
        inLanguage: schemaLanguage(item.language || item.bookLanguage),
        dateModified: isoDate(item.updatedAt),
        isAccessibleForFree: true,
        ...(section === "reading" && item.bookId && item.bookName ? {
            isPartOf: { "@type": "Book", name: seoText(item.bookName), url: `${SITE_URL}/library/${item.bookAlias || String(item.bookId)}` },
        } : {}),
    };
}

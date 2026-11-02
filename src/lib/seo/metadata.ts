import type { Metadata } from "next";
import { SITE_URL } from "@/utils/site";

export const SITE_NAME = "Уставные чтения";
export const SITE_DESCRIPTION = "Уставные чтения по Типикону: Библия, Пролог, творения святых отцов и богослужебные тексты. Библиотека книг и чтения церковного года.";
export const SOCIAL_IMAGE = { url: `${SITE_URL}/icons/icon-512.png`, width: 512, height: 512, alt: SITE_NAME };

/** Описание в head — обычный текст, без разметки корпуса и ударений. */
export function seoText(value: string | null | undefined, limit = 180): string {
    const text = (value || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\{[^{}|]+\|(?:[^{}|]+\|)?([^{}]*)\}/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/[*_`#]/g, "")
        .replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&")
        .replace(/[\u0300\u0301]/g, "")
        .replace(/\s+/g, " ").trim();
    if (text.length <= limit) return text;
    const short = text.slice(0, limit - 1);
    const end = short.lastIndexOf(" ");
    return `${end > limit * 0.65 ? short.slice(0, end) : short}…`;
}

export function pageMetadata({ title, description, path, noindex = false, type = "website" }: {
    title: string;
    description: string;
    path: string;
    noindex?: boolean;
    type?: "website" | "article";
}): Metadata {
    const name = seoText(title, 140);
    const fullTitle = name.includes(SITE_NAME) ? name : `${name} — ${SITE_NAME}`;
    const summary = seoText(description);
    const url = new URL(path, SITE_URL).toString();
    return {
        title: fullTitle,
        description: summary,
        alternates: { canonical: url },
        ...(noindex ? { robots: { index: false, follow: true } } : {}),
        openGraph: { type, title: fullTitle, description: summary, url, siteName: SITE_NAME, locale: "ru_RU", images: [SOCIAL_IMAGE] },
        twitter: { card: "summary", title: fullTitle, description: summary, images: [SOCIAL_IMAGE.url] },
    };
}

export function isoDate(value: unknown): string | undefined {
    if (!(typeof value === "string" || typeof value === "number" || value instanceof Date)) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export const schemaLanguage = (code?: string): string | undefined =>
    code ? ({ cu_gr: "cu", ru_cu: "ru", ro_cyr: "ro", cv_cu: "cv" }[code] || code) : undefined;

/** Защита script-контекста: текст произведения не может закрыть JSON-LD тег. */
export const serializeJsonLd = (value: unknown): string => JSON.stringify(value)
    .replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

export const breadcrumbs = (items: Array<{ name: string; path: string }>) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
        "@type": "ListItem", position: index + 1, name: seoText(item.name, 140), item: new URL(item.path, SITE_URL).toString(),
    })),
});

import type { MetadataRoute } from "next";
import { SITE_URL } from "@/utils/site";
import { isoDate } from "./metadata";

/** Неизвестная дата не означает «обновлено сегодня». */
export function sitemapEntry(path: string, modified: unknown, priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "monthly"): MetadataRoute.Sitemap[number] {
    const date = isoDate(modified);
    return { url: `${SITE_URL}${path}`, ...(date ? { lastModified: new Date(date) } : {}), changeFrequency, priority };
}

export function dedupeSitemap(items: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
    const byUrl = new Map<string, MetadataRoute.Sitemap[number]>();
    for (const item of items) {
        const previous = byUrl.get(item.url);
        const before = isoDate(previous?.lastModified) || "";
        const after = isoDate(item.lastModified) || "";
        if (!previous || before < after) byUrl.set(item.url, item);
    }
    return [...byUrl.values()];
}

/** Canonical storage is string[]. Older imports may still supply one string. */
export function textLinks(value: unknown): string[] {
    const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
    return [...new Set(values.filter((v): v is string => typeof v === "string").map(v => v.trim()).filter(Boolean))];
}
export function validTextLinks(value: unknown): string[] {
    if (value !== undefined && value !== null && typeof value !== "string"
        && (!Array.isArray(value) || !value.every(v => typeof v === "string"))) throw new Error("Ссылки должны быть списком адресов");
    const urls = textLinks(value);
    if (urls.length > 30 || urls.some(url => { try { return !["http:", "https:"].includes(new URL(url).protocol) || url.length > 4096; } catch { return true; } })) {
        throw new Error("Укажите до 30 ссылок, начинающихся с http:// или https://");
    }
    return urls;
}
/** Frozen v1 clients expect scalar link/ruLink, including inside calendar items. */
export function legacyTextLinks<T>(value: T): T {
    if (Array.isArray(value)) return value.map(legacyTextLinks) as T;
    if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key,
            (key === "link" || key === "ruLink") && Array.isArray(entry) ? textLinks(entry)[0] || null : legacyTextLinks(entry),
        ])) as T;
    }
    return value;
}

/** Богослужебная редакция; библейские ranges служат параллельными ссылками, не её телом. */
export interface LiturgicalText {
    language: "cs";
    sourceTitle: string;
    sourceUrl: string;
    content: string;
    referencesOnly: true;
}

export function liturgicalText(value: unknown): LiturgicalText | null {
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    if (v.language !== "cs" || v.referencesOnly !== true
        || typeof v.sourceTitle !== "string" || !v.sourceTitle.trim()
        || typeof v.content !== "string" || !v.content.trim()
        || typeof v.sourceUrl !== "string") return null;
    try {
        const url = new URL(v.sourceUrl);
        if (url.protocol !== "https:" || url.username || url.password) return null;
    } catch { return null; }
    return { language: "cs", sourceTitle: v.sourceTitle, sourceUrl: v.sourceUrl,
        content: v.content, referencesOnly: true };
}

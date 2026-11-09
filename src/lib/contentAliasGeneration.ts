import { slugify } from "@/lib/news/format";

/** Existing addresses stay stable; this is an explicit editor action. */
export function contentAliasBase(name: string, bookType?: string) {
    const title = name.normalize("NFC").replace(/[\u0300\u0301]/g, "").trim();
    if (!title || !/[\p{L}\p{N}]/u.test(title)) throw new Error("Сначала задайте название");
    const base = [bookType ? slugify(bookType) : "", slugify(title)].filter(Boolean).join("-").slice(0, 110).replace(/-+$/g, "");
    return /^[a-f0-9]{24}$/i.test(base) ? `book-${base}` : base;
}

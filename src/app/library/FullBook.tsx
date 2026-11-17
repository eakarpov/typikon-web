import { cache } from "react";
import { notFound } from "next/navigation";
import { FULL_BOOK_ALIASES, fullBookQuery, type BookSearch } from "@/lib/fullBooks";
import { pageMetadata } from "@/lib/seo/metadata";

type Fragment = { title: string; html: string; css: string; alias: string; version: string; script: string | null };
// Metadata and page share one request, including for long Georgian chapters.
const fragment = cache(async (alias: string, query: string, view: "reader" | "records"): Promise<Fragment> => {
    if (!FULL_BOOK_ALIASES.has(alias)) notFound();
    const base = process.env.ORDO_SERVICE_URL;
    if (!base) throw new Error("ORDO_SERVICE_URL is required for full books");
    const params = new URLSearchParams(query);
    params.set("view", view);
    const response = await fetch(`${base.replace(/\/$/, "")}/library/${alias}/fragment.json?${params}`, {
        cache: "no-store", signal: AbortSignal.timeout(90000),
    });
    if (response.status === 404) notFound();
    if (!response.ok) throw new Error(`Full-book service returned ${response.status}`);
    const result: Fragment = await response.json();
    if (result.alias !== alias || typeof result.html !== "string" || typeof result.css !== "string") {
        throw new Error("Invalid full-book fragment");
    }
    return result;
});
export async function fullBookMetadata(alias: string, search: BookSearch, view: "reader" | "records" = "reader") {
    const book = await fragment(alias, fullBookQuery(search), view);
    return pageMetadata({ title: book.title, description: "Полная книга с киноварью и переходами к записям библиотеки.",
        path: `/library/${alias}`, noindex: view === "records" || Boolean(search.q) });
}
export default async function FullBook({ alias, searchParams, view = "reader" }: {
    alias: string; searchParams: BookSearch; view?: "reader" | "records";
}) {
    const book = await fragment(alias, fullBookQuery(searchParams), view);
    // Only the internal service's sanitized book markup is accepted; its CSS is scoped to this wrapper.
    return <div className="full-book" data-book={alias} data-version={book.version} data-script={book.script}>
        <style dangerouslySetInnerHTML={{ __html: book.css }} />
        <div dangerouslySetInnerHTML={{ __html: book.html }} />
    </div>;
}

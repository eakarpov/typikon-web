export type State = "unsearched" | "published" | "not_found" | "in_progress";
export type Stage = "done" | "partial" | "pending" | "not_required";
export interface Entry {
    book: string; language: string; status: State; stages: Stage[];
    quality: { percent: number | null; label: string; basis?: string };
    tags: string[]; evidence: string[]; updated_at: string;
    alias?: string; edition?: string; search_note?: string;
}
export interface Registry {
    schema_version: number; updated_at: string; scope_note: string;
    stages: { id: number; label: string }[];
    languages: { id: string; label: string }[];
    books: { id: string; label: string }[];
    cells: Entry[]; references: { label: string; url: string }[];
}
export const labels: Record<State, string> = {
    unsearched: "Не искалось", published: "Выложено", not_found: "Не найдено", in_progress: "В работе",
};
export function stateOf(entries: Entry[]): State {
    if (!entries.length) return "unsearched";
    if (entries.every(e => e.status === "published")) return "published";
    if (entries.some(e => e.status === "in_progress" || e.status === "published")) return "in_progress";
    if (entries.every(e => e.status === "not_found")) return "not_found";
    return "unsearched";
}
// Entries for different textual witnesses must never be merged into a fictitious complete pipeline.
export function indexEntries(entries: Entry[]) {
    const result = new Map<string, Entry[]>();
    for (const entry of entries) {
        const key = `${entry.book}/${entry.language}`;
        result.set(key, [...(result.get(key) ?? []), entry]);
    }
    return result;
}

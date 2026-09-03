import { podobnyIndex } from "@/lib/podobny/store";
import type { PodobenUnit } from "@/lib/podobny/core";

export const PAGE_SIZE = 50;

export type PodobnySort = "items" | "name";

export interface PodobnyPageData {
    items: PodobenUnit[];
    total: number;
    /** Языки и гласы, которые в указателе вообще есть. */
    languages: string[];
    tones: number[];
    corpusMissing: boolean;
}

// Указатель считается целиком и живёт в памяти процесса (см. store.ts), так
// что страницу отбираем по массиву, а не запросом: 497 единиц — это меньше,
// чем одна страница поиска по песнопениям, и заводить ради них SQL с LIMIT
// значило бы держать вторую выборку, которая обязана согласовываться с первой.

const matches = (unit: PodobenUnit, params: Record<string, string | undefined>): boolean => {
    if (params.language && !unit.languages.some((l) => l.code === params.language)) return false;
    if (params.tone && unit.tone !== Number(params.tone)) return false;
    // «Сводные» — те, где ключ издания связал языки: их 79, и это единственный
    // отбор, показывающий, что ключ вообще даёт.
    if (params.merged === "1" && !unit.agesKey) return false;
    return true;
};

export const podobnyData = (params: Record<string, string | undefined>): PodobnyPageData => {
    const index = podobnyIndex();
    if (!index) {
        return { items: [], total: 0, languages: [], tones: [], corpusMissing: true };
    }

    const sort: PodobnySort = params.sort === "name" ? "name" : "items";
    const found = index.filter((unit) => matches(unit, params));

    const sorted = sort === "name"
        ? [...found].sort((a, b) =>
            (a.names[0]?.printed ?? "").localeCompare(b.names[0]?.printed ?? "", "ru"))
        : [...found].sort((a, b) => b.items - a.items || a.slug.localeCompare(b.slug));

    const page = Math.max(1, Number(params.page) || 1);

    return {
        items: sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        total: sorted.length,
        languages: [...new Set(index.flatMap((u) => u.languages.map((l) => l.code)))].sort(),
        tones: [...new Set(index.map((u) => u.tone).filter((t): t is number => !!t))].sort((a, b) => a - b),
        corpusMissing: false,
    };
};

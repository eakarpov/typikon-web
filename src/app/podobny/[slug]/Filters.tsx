'use client';
import React, { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BOOK_LABELS, UNIT_LABELS, labelOf, monthLabel } from "@/utils/chantLabels";
import { bookLanguageLabel } from "@/utils/bookLanguages";

// Единственный клиентский файл раздела: за границу 'use client' переходят
// только типы и чистые словари подписей (см. akathists/Filters.tsx о том, чем
// это кончается иначе).

interface Props {
    facets: {
        books: string[];
        months: number[];
        units: string[];
        languages: string[];
    } | null;
    params: Record<string, string | undefined>;
}

const SELECT_CLASS = "border rounded px-1 py-0.5 text-sm font-serif bg-white";

const Filters = ({ facets, params }: Props) => {
    const router = useRouter();
    const pathname = usePathname();

    const push = useCallback((changes: Record<string, string>) => {
        const next = new URLSearchParams();
        for (const [k, v] of Object.entries(params)) if (v) next.set(k, v);
        for (const [k, v] of Object.entries(changes)) {
            if (v) next.set(k, v); else next.delete(k);
        }
        next.delete("page");
        router.push(`${pathname}?${next.toString()}`);
    }, [params, pathname, router]);

    if (!facets) return null;

    // Значения сортируем по ПОДПИСИ, а не по ключу: корпус отдаёт роды строк
    // по латинскому имени, и на вид они шли бы вразнобой.
    const select = (name: string, empty: string, options: string[], table: Record<string, string>) => (
        options.length > 1 ? (
            <select className={SELECT_CLASS} value={params[name] || ""}
                    onChange={(e) => push({ [name]: e.target.value })}>
                <option value="">{empty}</option>
                {[...options]
                    .sort((a, b) => labelOf(table, a).localeCompare(labelOf(table, b), "ru"))
                    .map((v) => <option key={v} value={v}>{labelOf(table, v)}</option>)}
            </select>
        ) : null
    );

    return (
        <div className="flex gap-2 items-baseline flex-wrap">
            {select("book", "из любой книги", facets.books, BOOK_LABELS)}
            {facets.months.length > 1 && (
                <select className={SELECT_CLASS} value={params.month || ""}
                        onChange={(e) => push({ month: e.target.value })}>
                    <option value="">в любой месяц</option>
                    {facets.months.map((month) => (
                        <option key={month} value={month}>{monthLabel(month)}</option>
                    ))}
                </select>
            )}
            {select("unit", "любого рода", facets.units, UNIT_LABELS)}
            {facets.languages.length > 1 && (
                <select className={SELECT_CLASS} value={params.language || ""}
                        onChange={(e) => push({ language: e.target.value })}>
                    <option value="">на любом языке</option>
                    {facets.languages.map((code) => (
                        <option key={code} value={code}>{bookLanguageLabel(code)}</option>
                    ))}
                </select>
            )}
        </div>
    );
};

export default Filters;

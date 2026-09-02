'use client';
import React, { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { IncipitFacets } from "@/lib/incipits";
import { SOURCE_LABELS, UNIT_LABELS, labelOf } from "@/utils/chantLabels";
import { bookLanguageLabel } from "@/utils/bookLanguages";

// Форма отдельным клиентским файлом. За границу 'use client' переходят только
// типы (они стираются) и чистые словари подписей: возьми отсюда Content хоть
// одно значение из @/lib/incipits, и в браузерный бандл уехали бы rulesDb и
// better-sqlite3 — см. подробный разбор в akathists/Filters.tsx.

interface Props {
    facets: IncipitFacets | null;
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

    const onSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        push({ q: String(new FormData(e.currentTarget).get("q") || "") });
    }, [push]);

    // Порядок значений задаём по ПОДПИСИ, а не по ключу: корпус отдаёт роды
    // строк отсортированными по латинскому имени, и в списке они шли бы
    // «Апостол, Евангелие, икос, ипакои, ирмос, кондак, молитва, паремия» —
    // то есть на вид случайно.
    const select = (name: string, empty: string, options: string[], table: Record<string, string>) => (
        <select className={SELECT_CLASS} value={params[name] || ""}
                onChange={e => push({ [name]: e.target.value })}>
            <option value="">{empty}</option>
            {[...options]
                .sort((a, b) => labelOf(table, a).localeCompare(labelOf(table, b), "ru"))
                .map(v => <option key={v} value={v}>{labelOf(table, v)}</option>)}
        </select>
    );

    return (
        <div className="flex flex-col gap-2">
            <form onSubmit={onSubmit} className="flex gap-2 items-baseline">
                <label className="font-serif">Начало песнопения:</label>
                <input
                    name="q"
                    defaultValue={params.q || ""}
                    className="border rounded px-2 py-1 font-serif grow max-w-md"
                    placeholder="воду прошед"
                />
                <button type="submit" className="font-serif border rounded px-3 py-1 bg-slate-50">
                    Найти
                </button>
            </form>
            {facets && (
                <div className="flex flex-wrap gap-2 items-baseline">
                    {/* Язык здесь не сужение выдачи, а выбор указателя: зачины
                        разных языков не пересекаются вовсе, и славянский со
                        своими 122 тысячами строк — не то же собрание, что
                        арабский с тремя сотнями. */}
                    <select className={SELECT_CLASS} value={params.language || ""}
                            onChange={e => push({ language: e.target.value })}>
                        <option value="">на всех языках</option>
                        {facets.languages.map(l => (
                            <option key={l.code} value={l.code}>
                                {bookLanguageLabel(l.code)} ({l.count.toLocaleString("ru")})
                            </option>
                        ))}
                    </select>
                    {select("unit", "любого рода", facets.units, UNIT_LABELS)}
                    {select("source", "откуда угодно", facets.sources, SOURCE_LABELS)}
                    <select className={SELECT_CLASS} value={params.sort || "alpha"}
                            onChange={e => push({ sort: e.target.value === "alpha" ? "" : e.target.value })}>
                        <option value="alpha">по алфавиту</option>
                        <option value="uses">сперва частые</option>
                    </select>
                    {Object.keys(params).some(k => k !== "page" && params[k]) && (
                        <button onClick={() => push({ q: "", language: "", unit: "", source: "", sort: "" })}
                                className="font-serif text-sm text-red-900 underline">
                            сбросить
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default Filters;

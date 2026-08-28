'use client';
import React, { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AkathistFacets } from "@/lib/akathists";
import { AKATHIST_STATUS_LABELS, SUBJECT_KIND_LABELS, labelOf } from "@/utils/chantLabels";

// Форма отдельным клиентским файлом, а не веткой внутри Content, — и это не
// вкусовщина. Клиентский модуль тянет за собой всё, что импортирует ЗНАЧЕНИЯМИ:
// стоило Content стать клиентским и взять оттуда PAGE_SIZE, как в браузерный
// бандл уехал @/lib/akathists, за ним @/lib/rulesDb и better-sqlite3 — и
// страница падала на promisify внутри драйвера SQLite. Отсюда правило: за
// границу 'use client' переходят только типы (они стираются) и чистые словари
// подписей; всё, что читает корпус, остаётся на сервере.

interface Props {
    facets: AkathistFacets | null;
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

    const select = (name: string, empty: string, options: string[], table: Record<string, string>) => (
        <select className={SELECT_CLASS} value={params[name] || ""}
                onChange={e => push({ [name]: e.target.value })}>
            <option value="">{empty}</option>
            {options.map(v => <option key={v} value={v}>{labelOf(table, v)}</option>)}
        </select>
    );

    return (
        <div className="flex flex-col gap-2">
            <form onSubmit={onSubmit} className="flex gap-2 items-baseline">
                {/* Здесь дательный уместен, в отличие от канонов: акафистники
                    подписывают их именно так — «Акафист святителю Николаю». */}
                <label className="font-serif">Кому акафист:</label>
                <input
                    name="q"
                    defaultValue={params.q || ""}
                    className="border rounded px-2 py-1 font-serif grow max-w-md"
                    placeholder="Богородице, Николаю"
                />
                <button type="submit" className="font-serif border rounded px-3 py-1 bg-slate-50">
                    Найти
                </button>
            </form>
            {facets && (
                <div className="flex flex-wrap gap-2 items-baseline">
                    {select("subject", "кому угодно", facets.subjectKinds, SUBJECT_KIND_LABELS)}
                    {select("status", "любого достоинства", facets.statuses, AKATHIST_STATUS_LABELS)}
                    {Object.keys(params).some(k => k !== "page" && params[k]) && (
                        <button onClick={() => push({ q: "", subject: "", status: "" })}
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

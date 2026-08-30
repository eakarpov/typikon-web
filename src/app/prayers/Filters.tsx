'use client';
import React, { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { PrayerFacets } from "@/lib/prayers";
import { PRAYER_KIND_LABELS, labelOf } from "@/utils/chantLabels";

// Клиентская только форма: Content читает корпус и остаётся серверным —
// иначе better-sqlite3 уезжает в браузерный бандл (см. app/akathists/Filters.tsx).

interface Props {
    facets: PrayerFacets | null;
    params: Record<string, string | undefined>;
}

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

    return (
        <div className="flex flex-col gap-2">
            <form onSubmit={onSubmit} className="flex gap-2 items-baseline">
                <label className="font-serif">Кому или зачин:</label>
                <input
                    name="q"
                    defaultValue={params.q || ""}
                    className="border rounded px-2 py-1 font-serif grow max-w-md"
                    placeholder="Николаю, Сергию, о всепетая"
                />
                <button type="submit" className="font-serif border rounded px-3 py-1 bg-slate-50">
                    Найти
                </button>
            </form>
            {facets && (
                <div className="flex flex-wrap gap-2 items-baseline">
                    <select
                        className="border rounded px-1 py-0.5 text-sm font-serif bg-white"
                        value={params.kind || ""}
                        onChange={e => push({ kind: e.target.value })}
                    >
                        <option value="">при ком угодно</option>
                        {facets.kinds.map(k => (
                            <option key={k} value={k}>{labelOf(PRAYER_KIND_LABELS, k)}</option>
                        ))}
                    </select>
                    {Object.keys(params).some(k => k !== "page" && params[k]) && (
                        <button onClick={() => push({ q: "", kind: "" })}
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

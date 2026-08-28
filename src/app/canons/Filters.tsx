'use client';
import React, { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { CanonFacets } from "@/lib/canons";
import {
    BOOK_LABELS, CANON_ROLE_LABELS, SERVICE_LABELS, labelOf,
} from "@/utils/chantLabels";

// Как и у песнопений, состояние формы живёт в адресе страницы, а не в
// компоненте: найденное можно переслать ссылкой, а «назад» возвращает к
// прежней выдаче, а не к пустой форме.

interface Props {
    facets: CanonFacets | null;
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

    const select = (name: string, empty: string, options: (string | number)[],
                    label: (v: any) => string) => (
        <select
            className={SELECT_CLASS}
            value={params[name] || ""}
            onChange={e => push({ [name]: e.target.value })}
        >
            <option value="">{empty}</option>
            {options.map(v => <option key={v} value={String(v)}>{label(v)}</option>)}
        </select>
    );

    const dirty = Object.keys(params).some(k => k !== "page" && params[k]);

    return (
        <div className="flex flex-col gap-2">
            <form onSubmit={onSubmit} className="flex gap-2 items-baseline">
                {/* «Имя», а не «кому»: книга подписывает память в родительном
                    падеже («Па́мять… Никола́я»), и поле, обещающее дательный,
                    заставляло бы набирать «Николаю» — чего в корпусе нет. */}
                <label className="font-serif">Имя или творец:</label>
                <input
                    name="q"
                    defaultValue={params.q || ""}
                    className="border rounded px-2 py-1 font-serif grow max-w-md"
                    placeholder="Николая, Дамаскина, Богородицы"
                />
                <button type="submit" className="font-serif border rounded px-3 py-1 bg-slate-50">
                    Найти
                </button>
            </form>

            {facets && (
                <div className="flex flex-wrap gap-2 items-baseline">
                    {select("book", "любая книга", facets.books, v => labelOf(BOOK_LABELS, v))}
                    {select("tone", "любой глас", facets.tones, v => `глас ${v}`)}
                    {select("service", "любая служба", facets.services, v => labelOf(SERVICE_LABELS, v))}
                    {select("role", "любая роль", facets.roles, v => labelOf(CANON_ROLE_LABELS, v))}
                    {dirty && (
                        <button
                            onClick={() => push({ q: "", book: "", tone: "", service: "", role: "" })}
                            className="font-serif text-sm text-red-900 underline"
                        >
                            сбросить
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default Filters;

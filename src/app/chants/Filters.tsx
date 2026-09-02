'use client';
import React, { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ChantFacets } from "@/lib/chants";
import {
    BOOK_LABELS, SERVICE_LABELS, SIGN_LABELS, SOURCE_LABELS, UNIT_LABELS,
    labelOf, monthLabel,
} from "@/utils/chantLabels";
import { bookLanguageShort } from "@/utils/bookLanguages";

// Форма поиска и сужения. Состояние держим не в компоненте, а в адресе
// страницы: тогда найденное можно переслать ссылкой, а «назад» возвращает к
// прежней выдаче, а не к пустой форме.

interface Props {
    facets: ChantFacets | null;
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
        // Любая правка отбрасывает на первую страницу: третьей страницы у
        // новой выдачи может попросту не быть.
        next.delete("page");
        router.push(`${pathname}?${next.toString()}`);
    }, [params, pathname, router]);

    const onSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        push({ q: String(form.get("q") || "") });
    }, [push]);

    const select = (name: string, empty: string, options: (string | number)[],
                    label: (v: any) => string) => (
        <select
            className={SELECT_CLASS}
            value={params[name] || ""}
            onChange={e => push({ [name]: e.target.value })}
        >
            <option value="">{empty}</option>
            {options.map(v => (
                <option key={v} value={String(v)}>{label(v)}</option>
            ))}
        </select>
    );

    return (
        <div className="flex flex-col gap-2">
            <form onSubmit={onSubmit} className="flex gap-2 items-baseline">
                <label className="font-serif">Поиск:</label>
                <input
                    name="q"
                    defaultValue={params.q || ""}
                    className="border rounded px-2 py-1 font-serif grow max-w-md"
                    placeholder="воззвах"
                />
                <button type="submit" className="font-serif border rounded px-3 py-1 bg-slate-50">
                    Найти
                </button>
            </form>

            {facets && (
                <div className="flex flex-wrap gap-2 items-baseline">
                    {/* Первым: он режет выдачу крупнее всех прочих вместе взятых. */}
                    {select("source", "книги, каноны и акафисты", facets.sources,
                            v => labelOf(SOURCE_LABELS, v))}
                    {select("book", "любая книга", facets.books, v => labelOf(BOOK_LABELS, v))}
                    {select("month", "любой месяц", facets.months, v => monthLabel(Number(v)))}
                    {select("tone", "любой глас", facets.tones, v => `глас ${v}`)}
                    {select("sign", "любой знак", facets.signs, v => labelOf(SIGN_LABELS, v))}
                    {select("service", "любая служба", facets.services, v => labelOf(SERVICE_LABELS, v))}
                    {select("unit", "любой род", facets.units, v => labelOf(UNIT_LABELS, v))}
                    {/* Язык предлагаем, только если языков и правда несколько:
                        на одноязычном корпусе такой отбор был бы обманом. */}
                    {facets.languages.length > 1 && select(
                        "language", "любой язык",
                        facets.languages.map(l => l.code),
                        v => `${bookLanguageShort(String(v))} · ${
                            facets.languages.find(l => l.code === v)?.count ?? 0}`)}
                    {Object.keys(params).some(k => k !== "q" && k !== "page" && params[k]) && (
                        <button
                            onClick={() => push({ source: "", book: "", month: "", tone: "", sign: "", service: "", unit: "", memory: "", language: "" })}
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

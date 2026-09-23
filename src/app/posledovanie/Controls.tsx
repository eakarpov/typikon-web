'use client';
import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { OrdoOptions } from "@/lib/ordo";
import { UKAZANIYA, type ViewChoice } from "@/lib/ordoView";
import { VIEW_PARAM } from "./params";

// Чем задаётся вопрос, кроме даты. Два рода ручек, и различаются они не видом:
// устав, язык, «языки рядом», бдение — меняют саму службу, и за ними идём на
// сервер; ПОДАЧА же службы не меняет, и переключается она на месте — адрес
// правится через history, без запроса.

interface Props {
    options: OrdoOptions;
    choices: ViewChoice[];
    ustav: string;
    lang: string;
    hasVigil: boolean;
    razdelno: boolean;
}

const SELECT = "w-full border rounded px-1 py-0.5 text-sm font-serif bg-white";
const LABEL = "text-[11px] text-slate-500 font-serif";

const Controls = ({ options, choices, ustav, lang, hasVigil, razdelno }: Props) => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const params = useMemo(() => searchParams ?? new URLSearchParams(), [searchParams]);

    const push = useCallback((changes: Record<string, string>) => {
        const next = new URLSearchParams(params.toString());
        for (const [k, v] of Object.entries(changes)) {
            if (v) next.set(k, v); else next.delete(k);
        }
        router.push(`${pathname}?${next.toString()}`);
    }, [params, pathname, router]);

    const setView = (view: string) => {
        const next = new URLSearchParams(params.toString());
        if (view === UKAZANIYA) next.delete(VIEW_PARAM); else next.set(VIEW_PARAM, view);
        window.history.replaceState(null, "", `?${next.toString()}`);
    };

    const view = params.get(VIEW_PARAM) || UKAZANIYA;

    return (
        <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-0.5">
                <span className={LABEL}>Подача</span>
                <select className={SELECT} value={view} onChange={e => setView(e.target.value)}>
                    {choices.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
            </label>
            <label className="flex flex-col gap-0.5">
                <span className={LABEL}>Устав</span>
                {/* Смена устава сбрасывает вариант: ключи вариантов у уставов свои */}
                <select className={SELECT} value={ustav}
                        onChange={e => push({ ustav: e.target.value, variant: "" })}>
                    {options.ustavy.map(u => <option key={u.ustav} value={u.ustav}>{u.label}</option>)}
                </select>
            </label>
            <label className="flex flex-col gap-0.5">
                <span className={LABEL}>Язык службы</span>
                <select className={SELECT} value={lang} onChange={e => push({ lang: e.target.value })}>
                    {options.languages.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
                </select>
            </label>
            <div className="flex flex-col gap-1 text-sm font-serif mt-1">
                {/* Та же строка на других языках — подстрочником. Состав службы
                    она НЕ меняет: устав решил его до переводов. */}
                <label className="flex gap-1 items-baseline"
                       title="Под каждой строкой — она же в других книгах. ⇄ — перевод заявлен издателем, ~ — только то же место">
                    <input type="checkbox" checked={!!params.get("parallel")}
                           onChange={e => push({ parallel: e.target.checked ? "all" : "" })} />
                    языки рядом
                </label>
                <label className="flex gap-1 items-baseline">
                    <input type="checkbox" checked={params.get("psalms") === "1"}
                           onChange={e => push({ psalms: e.target.checked ? "1" : "" })} />
                    тексты псалмов
                </label>
                {hasVigil && (
                    // «Идеже всенощных не бывает» (гл. 7): вечерня и утреня
                    // порознь — уставная возможность, а не наша поправка.
                    <label className="flex gap-1 items-baseline">
                        <input type="checkbox" checked={razdelno}
                               onChange={e => push({ bdenie: e.target.checked ? "0" : "" })} />
                        вечерня и утреня раздельно, без бдения
                    </label>
                )}
            </div>
        </div>
    );
};

export default Controls;

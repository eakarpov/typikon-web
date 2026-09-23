'use client';
import { useCallback, useEffect, useState, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
    formatTransfer, parseTransfer,
    type OrdoDay, type OrdoMemoryFound, type OrdoTransfer,
} from "@/lib/ordo";

// Памяти дня и чем их можно поправить.
//
// Памяти называет устав, и выбрать их руками нельзя: переставив их, человек
// получил бы службу, которой ни одна книга не назначала. Можно другое, и
// ровно то, что допускает сам устав:
//   — ВАРИАНТ дня: второй святой главным, храмовая глава, воля настоятеля,
//     Маркова глава. Первый — тот, что назначает устав;
//   — ПЕРЕНОС памяти с другого дня, главной или второй.

const MemoryChoice = ({ day, variantKey }: { day: OrdoDay; variantKey: string | null }) => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const params = useMemo(() => searchParams ?? new URLSearchParams(), [searchParams]);
    const [q, setQ] = useState("");
    const [found, setFound] = useState<OrdoMemoryFound[] | null>(null);

    const transfers = params.getAll("perenos")
        .map(parseTransfer).filter((t): t is OrdoTransfer => t !== null);

    const push = useCallback((edit: (p: URLSearchParams) => void) => {
        const next = new URLSearchParams(params.toString());
        edit(next);
        router.push(`${pathname}?${next.toString()}`);
    }, [params, pathname, router]);

    const setTransfers = (list: OrdoTransfer[]) => push(p => {
        p.delete("perenos");
        // перенос меняет варианты дня: прежний ключ мог и пропасть
        p.delete("variant");
        for (const t of list) p.append("perenos", formatTransfer(t));
    });

    useEffect(() => {
        const query = q.trim();
        if (query.length < 3) { setFound(null); return; }
        const ctrl = new AbortController();
        const timer = setTimeout(() => {
            fetch(`/api/ordo/memories?q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
                .then(r => r.ok ? r.json() : [])
                .then(setFound)
                .catch(() => {});
        }, 300);
        return () => { clearTimeout(timer); ctrl.abort(); };
    }, [q]);

    const recommended = day.variants[0]?.key;

    return (
        <div className="font-serif flex flex-col gap-3 mb-2">
            <ul className="flex flex-col gap-0.5">
                {day.memories.map(m => <li key={m.memoryId}>{m.label}</li>)}
                {day.transfers.map(t => (
                    <li key={t.memoryId} className="text-slate-700">
                        {t.label}
                        <span className="text-xs text-slate-500">
                            {" "}— перенесена сюда{t.primary ? ", главной" : ", второй"}
                        </span>
                        <button className="text-xs text-red-900 ml-2 hover:underline"
                                onClick={() => setTransfers(transfers.filter(x => x.memoryId !== t.memoryId))}>
                            убрать
                        </button>
                    </li>
                ))}
            </ul>

            {day.variants.length > 1 && (
                <fieldset className="flex flex-col gap-1">
                    <legend className="text-xs text-slate-500 mb-1">Как служить</legend>
                    {day.variants.map(v => (
                        <label key={v.key} className="flex gap-2 items-baseline text-sm">
                            <input type="radio" name="variant" checked={v.key === variantKey}
                                   onChange={() => push(p => {
                                       if (v.key === recommended) p.delete("variant");
                                       else p.set("variant", v.key);
                                   })} />
                            <span>
                                {v.label}
                                {v.key === recommended && <span className="text-slate-500"> (по уставу)</span>}
                                <span className="block text-xs text-slate-500">
                                    {v.markLabel}{v.why ? ` · ${v.why}` : ""}
                                </span>
                            </span>
                        </label>
                    ))}
                </fieldset>
            )}

            <details className="text-sm">
                <summary className="cursor-pointer text-xs text-slate-500">Перенести память на этот день</summary>
                <input type="search" value={q} onChange={e => setQ(e.target.value)}
                       placeholder="имя святого или праздника"
                       className="border rounded px-2 py-0.5 mt-1 w-full max-w-sm" />
                {found && (
                    <ul className="mt-1 max-h-64 overflow-auto flex flex-col gap-0.5">
                        {found.length === 0 && <li className="text-slate-500">ничего не нашлось</li>}
                        {found.map(m => (
                            <li key={m.memoryId} className="leading-snug">
                                {m.label}
                                {m.month && m.day && (
                                    <span className="text-xs text-slate-400"> ({m.day}.{String(m.month).padStart(2, "0")})</span>
                                )}
                                <button className="text-xs text-red-900 ml-2 hover:underline"
                                        onClick={() => setTransfers([...transfers.filter(x => x.memoryId !== m.memoryId),
                                            { memoryId: m.memoryId, primary: true }])}>
                                    главной
                                </button>
                                <button className="text-xs text-red-900 ml-2 hover:underline"
                                        onClick={() => setTransfers([...transfers.filter(x => x.memoryId !== m.memoryId),
                                            { memoryId: m.memoryId, primary: false }])}>
                                    второй
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </details>
        </div>
    );
};

export default MemoryChoice;

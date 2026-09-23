"use client";
import { useEffect, useState } from "react";
import type { TripStop } from "@/lib/pilgrimage/trip";

// Поиск остановки: храм или место по имени. Запрос уходит, когда человек
// перестал печатать, а не на каждую букву.
type Hit = TripStop & { note: string | null };

const StopPicker = ({ onPick }: { onPick: (stop: TripStop) => void }) => {
    const [q, setQ] = useState("");
    const [hits, setHits] = useState<Hit[]>([]);

    useEffect(() => {
        if (q.trim().length < 2) { setHits([]); return; }
        const ctrl = new AbortController();
        const timer = setTimeout(() => {
            fetch(`/api/pilgrimage/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal })
                .then((r) => r.json()).then((d) => setHits(d.items ?? [])).catch(() => {});
        }, 300);
        return () => { clearTimeout(timer); ctrl.abort(); };
    }, [q]);

    return (
        <div className="font-serif">
            <input className="border rounded px-2 py-1 bg-white w-full" value={q} onChange={(e) => setQ(e.target.value)}
                   placeholder="Храм или место: «Троице-Сергиева», «Суздаль», «Валаам»" aria-label="Найти храм или место" />
            {!!hits.length && (
                <ul className="border rounded mt-1 bg-white max-h-64 overflow-auto">
                    {hits.map((h) => (
                        <li key={`${h.kind}:${h.slug}`}>
                            <button type="button" className="w-full text-left px-2 py-1 hover:bg-amber-50"
                                    onClick={() => { onPick({ kind: h.kind, slug: h.slug, name: h.name }); setQ(""); setHits([]); }}>
                                {h.name}{h.note && <span className="text-slate-500 text-sm"> — {h.note}</span>}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default StopPicker;

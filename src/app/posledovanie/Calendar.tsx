'use client';
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MONTH_LABELS } from "@/utils/chantLabels";
import { KEEP_ACROSS_DAYS, todayIso } from "./params";

// Месяц гражданского календаря — гражданского, потому что человек живёт в
// нём; церковное число названо в шапке дня. Листается месяцами на месте, без
// запроса; запрос уходит, когда выбран день.

const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
const pad = (n: number) => String(n).padStart(2, "0");

const Calendar = ({ date }: { date: string }) => {
    const params = useSearchParams() ?? new URLSearchParams();
    const [y0, m0] = date.split("-").map(Number);
    const [shown, setShown] = useState({ y: y0, m: m0 });
    const today = todayIso();

    const hrefOf = (iso: string) => {
        const next = new URLSearchParams();
        for (const k of KEEP_ACROSS_DAYS) {
            const v = params.get(k);
            if (v) next.set(k, v);
        }
        next.set("date", iso);
        return `?${next.toString()}`;
    };

    const first = new Date(Date.UTC(shown.y, shown.m - 1, 1));
    const lead = (first.getUTCDay() + 6) % 7;
    const days = new Date(Date.UTC(shown.y, shown.m, 0)).getUTCDate();
    const step = (delta: number) => setShown(({ y, m }) => {
        const d = new Date(Date.UTC(y, m - 1 + delta, 1));
        return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
    });

    return (
        <div className="font-serif select-none">
            <div className="flex items-center justify-between mb-1">
                <button onClick={() => step(-1)} className="px-2 text-slate-500 hover:text-red-900"
                        aria-label="Предыдущий месяц">‹</button>
                <span className="capitalize">{MONTH_LABELS[shown.m]} {shown.y}</span>
                <button onClick={() => step(1)} className="px-2 text-slate-500 hover:text-red-900"
                        aria-label="Следующий месяц">›</button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center text-sm">
                {WEEKDAYS.map(w => <div key={w} className="text-[11px] text-slate-400">{w}</div>)}
                {Array.from({ length: lead }, (_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: days }, (_, i) => {
                    const iso = `${shown.y}-${pad(shown.m)}-${pad(i + 1)}`;
                    const sunday = (lead + i) % 7 === 6;
                    const cls = iso === date
                        ? "bg-red-900 text-white"
                        : `${sunday ? "text-red-900" : "text-slate-700"} hover:bg-slate-100`
                            + (iso === today ? " ring-1 ring-red-900/40" : "");
                    return (
                        <Link key={iso} href={hrefOf(iso)} className={`rounded py-1 ${cls}`}>
                            {i + 1}
                        </Link>
                    );
                })}
            </div>
            {date !== today && (
                <Link href={hrefOf(today)} className="block text-xs text-slate-500 hover:text-red-900 mt-1">
                    сегодня
                </Link>
            )}
        </div>
    );
};

export default Calendar;

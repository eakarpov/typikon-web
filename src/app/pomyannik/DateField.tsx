'use client';
import { useState } from "react";
import { personalDate, dateParts } from "@/lib/pomyannik/dates";
const FIELD = "border rounded px-2 py-1 bg-white max-w-full min-w-0";
type Precision = "full" | "year" | "monthday";
export default function DateField({ label, value, onChange }: { label: string; value: string | null; onChange: (value: string | null) => void }) {
    const [precision, setPrecision] = useState<Precision>(value?.startsWith("--") ? "monthday" : value?.length === 4 ? "year" : "full");
    return <fieldset className="flex flex-col gap-1 font-serif text-sm min-w-0">
        <legend className="text-slate-600">{label}</legend>
        <select className={FIELD} aria-label={`Точность: ${label}`} value={precision} onChange={e => {
            const next = e.target.value as Precision;
            const parts = dateParts(value);
            setPrecision(next);
            onChange(next === "year" && parts?.year ? String(parts.year).padStart(4, "0")
                : next === "monthday" && parts?.month && parts.day ? `--${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`
                : next === "full" && value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);
        }}>
            <option value="full">Точная дата</option><option value="year">Только год</option><option value="monthday">День и месяц без года</option>
        </select>
        {precision === "full" ? <input className={FIELD} aria-label={label} type="date" value={value ?? ""} onChange={e => onChange(e.target.value || null)} />
            : <input className={FIELD} aria-label={label} inputMode={precision === "year" ? "numeric" : "decimal"} placeholder={precision === "year" ? "Например, 1950" : "ДД.ММ"}
                value={precision === "monthday" ? (value?.startsWith("--") ? `${value.slice(5, 7)}.${value.slice(2, 4)}` : value ?? "") : value ?? ""}
                onChange={e => { const raw = e.target.value; const m = /^(\d{2})\.(\d{2})$/.exec(raw); onChange(!raw ? null : precision === "monthday" && m ? `--${m[2]}-${m[1]}` : raw); }}
                aria-invalid={Boolean(value && !personalDate(value))} />}
    </fieldset>;
}

'use client';
import React, { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { bookLanguageLabel } from "@/utils/bookLanguages";

// Форма отдельным клиентским файлом, и за границу 'use client' переходят
// только типы и чистые подписи: возьми Content отсюда хоть одно значение из
// @/lib/podobny/store, и в браузерный бандл уехал бы better-sqlite3 — тот же
// разбор, что в akathists/Filters.tsx.

interface Props {
    languages: string[];
    tones: number[];
    params: Record<string, string | undefined>;
}

const SELECT_CLASS = "border rounded px-1 py-0.5 text-sm font-serif bg-white";

const Filters = ({ languages, tones, params }: Props) => {
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

    return (
        <div className="flex gap-2 items-baseline flex-wrap">
            {languages.length > 1 && (
                <select className={SELECT_CLASS} value={params.language || ""}
                        onChange={(e) => push({ language: e.target.value })}>
                    <option value="">на любом языке</option>
                    {languages.map((code) => (
                        <option key={code} value={code}>{bookLanguageLabel(code)}</option>
                    ))}
                </select>
            )}

            <select className={SELECT_CLASS} value={params.tone || ""}
                    onChange={(e) => push({ tone: e.target.value })}>
                <option value="">любой глас</option>
                {tones.map((tone) => <option key={tone} value={tone}>глас {tone}</option>)}
            </select>

            <select className={SELECT_CLASS} value={params.sort || "items"}
                    onChange={(e) => push({ sort: e.target.value === "items" ? "" : e.target.value })}>
                <option value="items">по числу стихир</option>
                <option value="name">по имени</option>
            </select>

            <label className="text-sm font-serif text-slate-600 flex gap-1 items-baseline">
                <input type="checkbox" checked={params.merged === "1"}
                       onChange={(e) => push({ merged: e.target.checked ? "1" : "" })} />
                только сведённые по языкам
            </label>
        </div>
    );
};

export default Filters;

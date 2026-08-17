"use client";

import Link from "next/link";
import {useCallback, useState} from "react";
import {useRouter} from "next/navigation";
import {SIGN} from "@/types/dto/days";
import {SignsListResult} from "@/lib/signs/list";
import {getMonthLabel} from "@/lib/common/date";

const SIGN_LABELS: Record<string, string> = {
    [SIGN.NO_SIGN]: "Без знака",
    [SIGN.HALLELUJAH]: "Аллилуйная",
    [SIGN.SIX_STICHERA]: "Шестеричная",
    [SIGN.DOXOLOGIC]: "Славословная",
    [SIGN.POLYELEOS]: "Полиелейная",
    [SIGN.VIGIL]: "Бденная",
    [SIGN.GREAT_VIGIL]: "Бдение (двунадесятый праздник)",
};

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: getMonthLabel(i) }));

interface ISearchParams {
    page?: string;
    q?: string;
    month?: string;
}

const PublicSignsListView = ({ result, searchParams }: { result: SignsListResult; searchParams: ISearchParams }) => {
    const router = useRouter();
    const [q, setQ] = useState(searchParams.q || "");

    const pushWith = useCallback((patch: Record<string, string | undefined>) => {
        const next = new URLSearchParams();
        const merged = { ...searchParams, ...patch };
        Object.entries(merged).forEach(([key, value]) => {
            if (value) next.set(key, value);
        });
        if (!("page" in patch)) next.delete("page");
        router.push(`/signs?${next.toString()}`);
    }, [router, searchParams]);

    const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            pushWith({ q: q || undefined });
        }
    };

    const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

    return (
        <div className="pt-2 font-serif">
            <div className="flex flex-row flex-wrap gap-2 items-end mb-2">
                <div className="flex flex-col">
                    <label>Поиск по названию</label>
                    <input
                        className="border-2"
                        value={q}
                        onChange={e => setQ(e.target.value)}
                        onKeyDown={onSearchKeyDown}
                    />
                </div>
                <div className="flex flex-col">
                    <label>Месяц</label>
                    <select
                        className="border-2"
                        value={searchParams.month || ""}
                        onChange={e => pushWith({ month: e.target.value || undefined })}
                    >
                        <option value="">Все</option>
                        {MONTHS.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="mb-2">
                Найдено: {result.total}
            </div>

            {result.items.map((sign: any) => (
                <div key={sign.id} className="flex flex-row mb-4">
                    <Link href={`/signs/${sign.id}`} className="text-slate-600 font-serif">
                        {sign.name} — ({sign.date}.{sign.month}) — {SIGN_LABELS[sign.sign] || sign.sign} (Источник: {sign.source})
                    </Link>
                </div>
            ))}

            <div className="flex flex-row gap-2 mt-2 items-center">
                <button
                    className="border-2 px-2 disabled:opacity-50"
                    disabled={result.page <= 1}
                    onClick={() => pushWith({ page: String(result.page - 1) })}
                >
                    Назад
                </button>
                <span>{result.page} / {totalPages}</span>
                <button
                    className="border-2 px-2 disabled:opacity-50"
                    disabled={result.page >= totalPages}
                    onClick={() => pushWith({ page: String(result.page + 1) })}
                >
                    Вперёд
                </button>
            </div>
        </div>
    );
};

export default PublicSignsListView;

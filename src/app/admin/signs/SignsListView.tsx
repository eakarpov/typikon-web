"use client";

import Link from "next/link";
import {useCallback, useState} from "react";
import {useRouter} from "next/navigation";
import {SIGN} from "@/types/dto/days";
import {SignsListResult} from "@/lib/signs/list";
import {getMonthLabel} from "@/lib/common/date";
import {SIGN_LABELS} from "@/utils/signs";

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: getMonthLabel(i) }));

interface ISearchParams {
    page?: string;
    q?: string;
    month?: string;
    sign?: string;
    source?: string;
    needsReview?: string;
}

const SignsListView = ({ result, searchParams }: { result: SignsListResult; searchParams: ISearchParams }) => {
    const router = useRouter();
    const [q, setQ] = useState(searchParams.q || "");

    const pushWith = useCallback((patch: Record<string, string | undefined>) => {
        const next = new URLSearchParams();
        const merged = { ...searchParams, ...patch };
        Object.entries(merged).forEach(([key, value]) => {
            if (value) next.set(key, value);
        });
        if (!("page" in patch)) next.delete("page");
        router.push(`/admin/signs?${next.toString()}`);
    }, [router, searchParams]);

    const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            pushWith({ q: q || undefined });
        }
    };

    const onAdd = () => {
        fetch("/api/admin/signs", { method: "POST" }).then(() => router.refresh());
    };

    const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

    return (
        <div className="flex flex-col">
            <p onClick={onAdd} className="cursor-pointer">
                Добавить память
            </p>

            <div className="flex flex-row flex-wrap gap-2 items-end mt-2 mb-2">
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
                <div className="flex flex-col">
                    <label>Знак</label>
                    <select
                        className="border-2"
                        value={searchParams.sign || ""}
                        onChange={e => pushWith({ sign: e.target.value || undefined })}
                    >
                        <option value="">Все</option>
                        {Object.values(SIGN).map(s => (
                            <option key={s} value={s}>{SIGN_LABELS[s]}</option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col">
                    <label>Источник</label>
                    <select
                        className="border-2"
                        value={searchParams.source || ""}
                        onChange={e => pushWith({ source: e.target.value || undefined })}
                    >
                        <option value="">Все</option>
                        <option value="typikon">Типикон</option>
                        <option value="eye">Церковное око</option>
                    </select>
                </div>
                <label className="flex flex-row items-center gap-1">
                    <input
                        type="checkbox"
                        checked={searchParams.needsReview === "true"}
                        onChange={e => pushWith({ needsReview: e.target.checked ? "true" : undefined })}
                    />
                    Только требующие проверки
                </label>
            </div>

            <div>
                Найдено: {result.total}
            </div>

            {result.items.map((item: any) => (
                <div className="flex flex-row mb-1 gap-2" key={item.id}>
                    <p className="text-slate-400 w-16">
                        {item.date}.{item.month}
                    </p>
                    <p className="w-40">
                        {SIGN_LABELS[item.sign] || item.sign}
                        {item.isDefault ? " •" : ""}
                        {item.needsReview ? " ⚠" : ""}
                    </p>
                    <Link href={`/admin/signs/${item.id}`} className="cursor-pointer flex-1">
                        {item.name || "Нет названия"}
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

export default SignsListView;

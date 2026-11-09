'use client';
import { useEffect, useState } from "react";
import { DocumentArrowDownIcon, ChartBarIcon, UsersIcon, SignalIcon } from "@heroicons/react/24/outline";

type Status = { pdf: boolean; statistics: boolean; users: number; online: number };
export default function StatusBadges() {
    const [data, setData] = useState<Status | null>(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        const update = async () => {
            if (document.visibilityState === "hidden") return;
            try {
                const response = await fetch("/api/admin/status", { cache: "no-store", signal: controller.signal });
                if (!response.ok) throw new Error();
                const value = await response.json();
                if (!controller.signal.aborted) { setData(value); setFailed(false); }
            } catch { if (!controller.signal.aborted) setFailed(true); }
        };
        void update();
        const timer = setInterval(update, 30_000);
        document.addEventListener("visibilitychange", update);
        return () => { controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", update); };
    }, []);
    const state = (ok?: boolean) => failed || ok === undefined ? "text-slate-400" : ok ? "text-green-700" : "text-red-700";
    const label = (name: string, ok?: boolean) => `${name}: ${failed ? "нет данных" : ok === undefined ? "проверка…" : ok ? "отвечает" : "недоступен"}`;
    return <span className="inline-flex items-center gap-2 text-xs whitespace-nowrap" aria-label="Состояние сайта">
        <span className={`inline-flex gap-1 items-center ${state(data?.pdf)}`} title={`${label("PDF", data?.pdf)}. Проверяется HTTP-сервис, без генерации документа.`} aria-label={label("PDF", data?.pdf)}><DocumentArrowDownIcon className="w-4 h-4" />PDF</span>
        <span className={`inline-flex gap-1 items-center ${state(data?.statistics)}`} title={label("Статистика", data?.statistics)} aria-label={label("Статистика", data?.statistics)}><ChartBarIcon className="w-4 h-4" />{failed ? "?" : data ? data.statistics ? "✓" : "×" : "…"}</span>
        <span className="inline-flex gap-1 items-center" title="Зарегистрированные пользователи"><UsersIcon className="w-4 h-4" />{failed ? "?" : data?.users ?? "…"}</span>
        <span className="inline-flex gap-1 items-center" title="Онлайн: уникальные пользователи с действующей сессией и активностью за последние 5 минут"><SignalIcon className="w-4 h-4" />{failed ? "?" : data?.online ?? "…"}</span>
    </span>;
}

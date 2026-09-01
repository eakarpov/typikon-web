'use client';
import React, {useCallback, useEffect, useState} from "react";
import Link from "next/link";
import {TrashIcon} from "@heroicons/react/24/outline";
import {
    clearSaved,
    formatBytes,
    formatSavedAt,
    forgetPage,
    isSupported,
    plural,
    SavedPage,
    savedUsage,
} from "@/lib/offline";

// Список отложенного: что именно человек оставил себе на случай без интернета,
// сколько это занимает и как убрать. Занятое место считает воркер по факту
// содержимого кэша, а не складывает записи описи: половину объёма делают общие
// для всех сохранённых страниц шрифты и скрипты, и приписывать их какой-то
// одной странице было бы неправдой.

const OfflinePages = () => {
    const [pages, setPages] = useState<SavedPage[] | null>(null);
    const [bytes, setBytes] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const refresh = useCallback(async () => {
        const answer = await savedUsage();
        if (!answer.ok) {
            setError(answer.error);
            setPages([]);
            return;
        }
        setError(null);
        setPages([...answer.saved].sort((a, b) => b.savedAt - a.savedAt));
        setBytes(answer.bytes ?? null);
    }, []);

    useEffect(() => {
        if (!isSupported()) {
            setPages([]);
            setError("этот браузер не умеет сохранять страницы для чтения без сети");
            return;
        }
        refresh();
    }, [refresh]);

    const onForget = useCallback(async (url: string) => {
        setBusy(true);
        await forgetPage(url);
        await refresh();
        setBusy(false);
    }, [refresh]);

    const onClear = useCallback(async () => {
        setBusy(true);
        await clearSaved();
        await refresh();
        setBusy(false);
    }, [refresh]);

    if (pages === null) {
        return <p className="font-serif text-slate-500">Смотрю, что отложено…</p>;
    }

    if (!pages.length) {
        return (
            <p className="font-serif text-slate-500">
                {error
                    ? `Пока ничего не отложено: ${error}.`
                    : "Пока ничего не отложено. На странице дня и на любом чтении есть "
                      + "«Читать без сети» — отмеченное так открывается и без интернета."}
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <p className="font-serif text-sm text-slate-500">
                {pages.length} {plural(pages.length, "страница", "страницы", "страниц")} для чтения без интернета
                {bytes !== null && `, вместе со шрифтами и разметкой — ${formatBytes(bytes)}`}.
            </p>
            <ul className="flex flex-col gap-1">
                {pages.map((page) => (
                    <li key={page.url} className="flex flex-row items-center gap-2">
                        <button
                            type="button"
                            onClick={() => onForget(page.url)}
                            disabled={busy}
                            title="Убрать"
                            aria-label={`Убрать «${page.label}»`}
                            className="text-slate-400 hover:text-red-600 disabled:cursor-wait"
                        >
                            <TrashIcon className="w-4 h-4" />
                        </button>
                        <Link
                            href={page.url}
                            className="font-serif text-amber-800 underline underline-offset-4"
                        >
                            {page.label}
                        </Link>
                        <span className="font-serif text-sm text-slate-400">
                            {formatSavedAt(page.savedAt)}
                        </span>
                    </li>
                ))}
            </ul>
            <div>
                <button
                    type="button"
                    onClick={onClear}
                    disabled={busy}
                    className="font-serif border border-slate-300 rounded px-2 py-1 text-sm disabled:cursor-wait"
                >
                    Убрать всё
                </button>
            </div>
        </div>
    );
};

export default OfflinePages;

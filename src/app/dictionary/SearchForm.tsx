'use client';
import React, { memo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Форма только уводит на страницу с запросом — искать умеет сервер. Прежняя версия
// ходила за результатами на /api/v1/dictionary, которого в проекте нет вовсе, так
// что список молча оставался тем, что пришёл с сервера.

const SearchForm = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [value, setValue] = useState(searchParams?.get("query") ?? "");

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        const query = value.trim();
        if (query) router.push(`/dictionary?query=${encodeURIComponent(query)}`);
    };

    return (
        <form onSubmit={submit} className="flex flex-row flex-wrap items-center gap-2">
            <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="глаголати"
                aria-label="Слово"
                className="font-serif border border-slate-300 rounded px-2 py-1"
            />
            <button
                type="submit"
                className="font-serif border border-slate-300 rounded px-3 py-1"
            >
                Найти
            </button>
        </form>
    );
};

export default memo(SearchForm);

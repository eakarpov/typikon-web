"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type FormEvent } from "react";
import { LIBRARY_SORT_OPTIONS, libraryHref, readLibraryQuery, type LibraryQuery } from "@/utils/libraryBooks";

type Options = [string, string][];

interface Props {
    query: LibraryQuery;
    languages: Options;
    scripts: Options;
    categories: Options;
}

const fieldClass = "min-h-10 rounded border border-stone-300 bg-white px-2 py-1 text-stone-900";

function FilterSelect({ label, name, value, options, empty }: {
    label: string;
    name: string;
    value: string;
    options: Options;
    empty?: string;
}) {
    return (
        <label className="flex min-w-0 max-w-full flex-col gap-1">
            {label}
            <select name={name} defaultValue={value} className={fieldClass}
                    onChange={event => event.currentTarget.form?.requestSubmit()}>
                {empty && <option value="">{empty}</option>}
                {value && !options.some(([code]) => code === value) && <option value={value}>{value}</option>}
                {options.map(([code, title]) => <option key={code} value={code}>{title}</option>)}
            </select>
        </label>
    );
}

export default function LibraryFilters({ query, languages, scripts, categories }: Props) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const inputs = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
        const next = libraryHref(readLibraryQuery(inputs));
        startTransition(() => router.push(next, { scroll: false }));
    };

    return (
        <form action="/library" method="get" onSubmit={submit} role="search" aria-label="Поиск книг" aria-busy={pending}
              className="mb-3 space-y-2 text-sm">
            {query.work && <input type="hidden" name="work" value={query.work} />}
            <div className="flex flex-wrap items-end gap-2">
                <label className="flex min-w-0 max-w-md flex-1 basis-56 flex-col gap-1">
                    Поиск по названию
                    <input name="q" type="search" maxLength={120} defaultValue={query.q} className={fieldClass}
                           placeholder="Введите название книги" />
                </label>
                <button type="submit" disabled={pending}
                        className="min-h-10 rounded border border-stone-300 bg-stone-100 px-3 text-stone-900 hover:bg-stone-200 disabled:opacity-50">
                    Найти
                </button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
                <FilterSelect label="Тип книги" name="category" value={query.category ?? ""} options={categories} empty="Все типы" />
                <FilterSelect label="Язык" name="lang" value={query.lang ?? ""} options={languages} empty="Все языки" />
                <FilterSelect label="Начертание" name="script" value={query.script ?? ""} options={scripts} empty="Все начертания" />
                <FilterSelect label="Сортировка" name="sort" value={query.sort} options={Object.entries(LIBRARY_SORT_OPTIONS)} />
                {(query.q || query.lang || query.script || query.work || query.category || query.sort !== "name") && (
                    <Link className="px-2 py-2 underline underline-offset-2" href="/library" scroll={false}>Сбросить</Link>
                )}
            </div>
        </form>
    );
}

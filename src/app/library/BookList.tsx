"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BOOK_CATEGORIES, bookCategoryLabel, BOOK_SCRIPTS, bookPresentation, filterLibraryBooks, libraryBookHref, type LibraryBook } from "@/utils/libraryBooks";

export default function BookList({ books }: { books: LibraryBook[] }) {
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();
    const lang = params?.get("lang") || "";
    const script = params?.get("script") || "";
    const work = params?.get("work") || "";
    const category = params?.get("category") || "";
    const visible = filterLibraryBooks(books, { lang, script, work, category });
    const languages = new Map(books.map(book => {
        const info = bookPresentation(book.language);
        return [info.lang, info.label];
    }));
    const scripts = new Set(books.map(book => bookPresentation(book.language).script));
    const update = (key: string, value: string) => {
        const next = new URLSearchParams(params?.toString());
        if (value) next.set(key, value);
        else next.delete(key);
        router.replace(`${pathname || "/library"}${next.size ? `?${next}` : ""}`, { scroll: false });
    };

    return (
        <div className="mt-4 font-serif">
            <div className="flex flex-wrap items-end gap-3 mb-3">
                <label className="flex flex-col gap-1 text-sm">
                    Язык
                    <select className="border border-stone-300 rounded px-2 py-1 bg-white" value={lang} onChange={e => update("lang", e.target.value)}>
                        <option value="">Все языки</option>
                        {lang && !languages.has(lang) && <option value={lang}>{lang}</option>}
                        {Array.from(languages).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                    </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                    Начертание
                    <select className="border border-stone-300 rounded px-2 py-1 bg-white" value={script} onChange={e => update("script", e.target.value)}>
                        <option value="">Все начертания</option>
                        {script && !scripts.has(script) && <option value={script}>{BOOK_SCRIPTS[script] || script}</option>}
                        {Array.from(scripts).map(code => <option key={code} value={code}>{BOOK_SCRIPTS[code]}</option>)}
                    </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                    Тематика
                    <select className="border border-stone-300 rounded px-2 py-1 bg-white" value={category} onChange={e => update("category", e.target.value)}>
                        <option value="">Все тематики</option>
                        {category && category !== "uncategorized" && !BOOK_CATEGORIES[category] && <option value={category}>{category}</option>}
                        {Object.entries(BOOK_CATEGORIES).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                        <option value="uncategorized">Не указана</option>
                    </select>
                </label>
                {(lang || script || work || category) && <Link className="text-sm text-red-900 py-1" href="/library" scroll={false}>Сбросить фильтры</Link>}
            </div>
            {work && <p className="text-sm text-stone-600 mb-2">Редакции произведения: {work}</p>}
            <p role="status" className="text-sm text-stone-500 mb-3">Книг: {visible.length} из {books.length}</p>
            {!visible.length && <p>По выбранным фильтрам книг нет. Попробуйте другое сочетание языка, начертания и тематики.</p>}
            <ol className="space-y-4 list-decimal list-inside">
                {visible.map(book => {
                    const info = bookPresentation(book.language);
                    const editions = book.workKey ? books.filter(other => other.workKey === book.workKey) : [];
                    return (
                        <li key={book.id}>
                            <Link className="font-bold hover:text-red-900" href={libraryBookHref(book)}>
                                {book.name}{book.author ? ` (${book.author})` : ""}
                            </Link>
                            <div className="flex flex-wrap gap-2 text-xs text-stone-600 mt-1">
                                <span className="rounded bg-stone-100 px-1.5 py-0.5">{info.label}</span>
                                <span className="rounded bg-stone-100 px-1.5 py-0.5">{info.scriptLabel}</span>
                                <span className="rounded bg-stone-100 px-1.5 py-0.5">{bookCategoryLabel(book.category)}</span>
                                {book.editionTitle && <span className="py-0.5">{book.editionTitle}</span>}
                            </div>
                            {book.description && <p className="text-stone-600">{book.description}</p>}
                            {editions.length > 1 && (
                                <Link className="text-sm text-red-900 hover:underline" href={`/library?work=${encodeURIComponent(book.workKey!)}`} scroll={false}>
                                    Все редакции ({editions.length})
                                </Link>
                            )}
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}

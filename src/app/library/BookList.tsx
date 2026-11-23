import Link from "next/link";
import {
    BOOK_CATEGORIES, bookCategoryLabel, bookPresentation, libraryBookHref, libraryHref, paginateLibraryBooks,
    type LibraryBook, type LibraryQuery,
} from "@/utils/libraryBooks";
import LibraryFilters from "./LibraryFilters";

const dateFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeZone: "Europe/Moscow" });
const pageLink = "rounded border border-stone-300 px-3 py-2 hover:underline";

export default function BookList({ books, query }: { books: LibraryBook[]; query: LibraryQuery }) {
    const { books: visible, total, page, pages, offset } = paginateLibraryBooks(books, query);
    const languages = new Map<string, string>();
    const scripts = new Map<string, string>();
    const categories = new Map(Object.entries(BOOK_CATEGORIES));
    const editionCounts = new Map<string, number>();
    for (const book of books) {
        const info = bookPresentation(book.language);
        languages.set(info.lang, info.label);
        scripts.set(info.script, info.scriptLabel);
        if (book.category && !categories.has(book.category)) {
            categories.set(book.category, bookCategoryLabel(book.category));
        }
        if (book.workKey) {
            editionCounts.set(book.workKey, (editionCounts.get(book.workKey) ?? 0) + 1);
        }
    }
    categories.set("uncategorized", "Не указана");
    const optionsByLabel = (options: Map<string, string>) => [...options].sort((a, b) => a[1].localeCompare(b[1], "ru"));

    return (
        <div className="mt-4 font-serif">
            <LibraryFilters key={libraryHref({ ...query, page: 1 })} query={query} languages={optionsByLabel(languages)}
                            scripts={optionsByLabel(scripts)} categories={[...categories]} />
            {query.work && <p className="mb-2 text-sm text-stone-600">Редакции произведения: {query.work}</p>}
            <p id="library-results" role="status" className="mb-3 scroll-mt-4 text-sm text-stone-600">
                {total ? `Книги ${offset + 1}–${offset + visible.length} из ${total}` : "Книги не найдены"}
            </p>
            {visible.length > 0 && (
                <ol start={offset + 1} className="list-inside list-decimal space-y-4">
                    {visible.map(book => {
                        const info = bookPresentation(book.language);
                        const editions = book.workKey ? editionCounts.get(book.workKey) ?? 0 : 0;
                        return (
                            <li key={book.id}>
                                <Link className="font-bold hover:text-red-900" href={libraryBookHref(book)}>
                                    {book.name}{book.author ? ` (${book.author})` : ""}
                                </Link>
                                <div className="mt-1 flex flex-wrap gap-2 text-xs text-stone-600">
                                    <span className="rounded bg-stone-100 px-1.5 py-0.5">{info.label}</span>
                                    <span className="rounded bg-stone-100 px-1.5 py-0.5">{info.scriptLabel}</span>
                                    <span className="rounded bg-stone-100 px-1.5 py-0.5">{bookCategoryLabel(book.category)}</span>
                                    {book.editionTitle && <span className="py-0.5">{book.editionTitle}</span>}
                                    {book.updatedAt && (
                                        <span className="py-0.5">Обновлено <time dateTime={book.updatedAt}>{dateFormat.format(new Date(book.updatedAt))}</time></span>
                                    )}
                                </div>
                                {book.description && <p className="text-stone-600">{book.description}</p>}
                                {book.workKey && editions > 1 && (
                                    <Link className="text-sm text-red-900 hover:underline" href={libraryHref({ work: book.workKey, sort: "name", page: 1 })} scroll={false}>
                                        Все редакции ({editions})
                                    </Link>
                                )}
                            </li>
                        );
                    })}
                </ol>
            )}
            {pages > 1 && (
                <nav aria-label="Страницы библиотеки" className="my-5 flex flex-wrap items-center gap-3 text-sm">
                    {page > 1 && <Link rel="prev" className={pageLink} href={`${libraryHref({ ...query, page: page - 1 })}#library-results`}>Назад</Link>}
                    <span>Страница {page} из {pages}</span>
                    {page < pages && <Link rel="next" className={pageLink} href={`${libraryHref({ ...query, page: page + 1 })}#library-results`}>Далее</Link>}
                </nav>
            )}
        </div>
    );
}

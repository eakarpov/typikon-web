import BookList from "./BookList";
import { isoDate } from "@/lib/seo/metadata";
import type { LibraryBook, LibraryQuery } from "@/utils/libraryBooks";

const Content = async ({ itemsPromise, query }: { itemsPromise: Promise<[any[], unknown?]>; query: LibraryQuery }) => {
    const [items, error] = await itemsPromise;
    if (error || !items) return <p>Ошибка при загрузке данных</p>;

    const books: LibraryBook[] = items.map(book => ({
        id: book._id.toString(),
        name: book.name,
        alias: book.alias,
        author: book.author,
        description: book.description,
        language: book.language,
        category: book.category,
        bibleCode: book.bibleCode,
        workKey: book.workKey,
        editionTitle: book.editionTitle,
        updatedAt: isoDate(book.updatedAt),
    }));
    return <BookList books={books} query={query} />;
};

export default Content;

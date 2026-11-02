import BookList from "./BookList";
import type { LibraryBook } from "@/utils/libraryBooks";

const Content = async ({ itemsPromise }: { itemsPromise: Promise<[any[], unknown?]> }) => {
    const [items, error] = await itemsPromise;
    if (error || !items) return <p>Ошибка при загрузке данных</p>;

    // Передаём в браузер только поля карточки, без texts[] и заметок редактора.
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
    }));
    return <BookList books={books} />;
};

export default Content;

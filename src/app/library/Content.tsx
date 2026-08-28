import Link from "next/link";
import {DEFAULT_BOOK_LANGUAGE, bookLanguageLabel, bookLanguageShort} from "@/utils/bookLanguages";

interface IError {
    error: string;
}

interface IContent {
    itemsPromise: Promise<[any[], IError?]>
}

const Content = async ({ itemsPromise }: IContent) => {

    const [items, error] = await itemsPromise;

    if (error) {
        return (
            <div>
                <p>
                    Ошибка при загрузке данных
                </p>
            </div>
        )
    }

    return (
        <div className="mt-2">
            {items.map((book: any, index: number) => (
                <div key={book._id.toString()} className="flex flex-col mb-4">
                    <p>
                        <Link
                            className="cursor-pointer font-bold font-serif"
                            href={`/library/${book._id.toString()}`}>
                            {index + 1}. {book.name} {book.author ? `(${book.author})` : ""}
                        </Link>
                        {/* Язык показываем, только когда он не тот, на котором
                            набрано большинство: значок «цс гражд.» у тридцати
                            восьми книг из сорока восьми не сообщал бы ничего,
                            а вот уставное начертание и румынская кириллица —
                            ровно то, что читателю надо знать до того, как он
                            откроет книгу. */}
                        {book.language && book.language !== DEFAULT_BOOK_LANGUAGE && (
                            <span
                                title={bookLanguageLabel(book.language)}
                                className="ml-2 text-xs px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 font-serif align-middle"
                            >
                                {bookLanguageShort(book.language)}
                            </span>
                        )}
                    </p>
                    {book.description && (
                        <p className="font-serif text-stone-600">
                            {book.description}
                        </p>
                    )}
                </div>
            ))}
        </div>
    );
};

export default Content;

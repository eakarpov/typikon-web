import Link from "next/link";

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

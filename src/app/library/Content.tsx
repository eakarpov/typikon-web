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
            {items.map((book: any) => (
                <div key={book._id.toString()} className="flex flex-row mb-4">
                    <p>
                        <Link
                            className="cursor-pointer"
                            href={`/library/${book._id.toString()}`}>
                            {book.name} {book.author ? `(${book.author})` : ""}
                        </Link>
                    </p>
                </div>
            ))}
        </div>
    );
};

export default Content;

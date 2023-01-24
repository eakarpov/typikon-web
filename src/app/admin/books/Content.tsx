import Link from "next/link";

const Content = async ({ itemsPromise }: { itemsPromise: Promise<any[]> }) => {

    const items = await itemsPromise;

    return (
        <div className="mt-2">
            {items.map((book: any) => (
                <div className="flex flex-row mb-4" key={book._id.toString()}>
                    <p className="text-slate-400 w-36">
                        Книга {book.name}
                    </p>
                    <div className="flex flex-col space-y-1">
                        <Link
                            href={`/admin/books/${book._id.toString()}`}
                            className="cursor-pointer"
                        >
                            {book._id.toString()}
                        </Link>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default Content;

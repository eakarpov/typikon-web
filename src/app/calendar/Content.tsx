import Link from "next/link";

const Content = async ({ itemsPromise }: { itemsPromise: Promise<any[]> }) => {

    const items = await itemsPromise;

    return (
        <div className="mt-2">
            {items.map((month: any) => (
                <div className="flex flex-row mb-4" key={month._id.toString()}>
                    <p className="text-slate-400 w-36">
                        <Link
                            href={`/months/${month.alias || month._id.toString()}`}
                            className="cursor-pointer"
                        >
                            Месяц {month.label.toLowerCase()}
                        </Link>
                    </p>
                </div>
            ))}
        </div>
    );
};

export default Content;

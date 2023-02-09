import Link from "next/link";

const Content = async ({ itemsPromise }: { itemsPromise: Promise<any[]> }) => {

    const items = await itemsPromise;

    return (
        <div className="mt-2">
            {items.map((month: any) => (
                <div className="flex flex-row mb-4" key={month._id.toString()}>
                    <p className="text-slate-400 w-36">
                        Месяц {month.value}
                    </p>
                    <div className="flex flex-col space-y-1">
                        <Link
                            href={`/admin/months/${month._id.toString()}`}
                            className="cursor-pointer"
                        >
                            {month._id.toString()} {month.alias && `(${month.alias})`}
                        </Link>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default Content;

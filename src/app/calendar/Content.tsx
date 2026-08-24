import Link from "next/link";

const Content = async ({ itemsPromise }: { itemsPromise: Promise<any[]> }) => {

    const items = await itemsPromise;

    return (
        <div className="mt-2">
            {/* Лента, на которую можно подписаться в своём календаре: чтения дня приходят
                туда, куда человек и так смотрит, без захода на сайт. */}
            <p className="font-serif mb-4">
                <a href="/calendar.ics" className="text-amber-800 underline underline-offset-4">
                    Подписаться на календарь чтений
                </a>
                <span className="text-sm text-slate-500">
                    {" "}— памяти и чтения дня в Google Календаре, Apple Календаре и любом
                    другом, понимающем подписку по ссылке
                </span>
            </p>
            {items.map((month: any) => (
                <div className="flex flex-row mb-4" key={month._id.toString()}>
                    <p className="text-slate-400 w-36">
                        <Link
                            href={`/months/${month.alias || month._id.toString()}`}
                            className="cursor-pointer font-serif"
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

import Link from "next/link";

const Content = async ({ itemsPromise }: { itemsPromise: Promise<any[]> }) => {

    const items = await itemsPromise;

    return (
        <div className="mt-2">
            {items.map((week: any) => (
                <div className="flex flex-row mb-4" key={week._id.toString()}>
                    <p className="text-slate-400 w-36">
                        {week.type === "Fast"
                            ? `Неделя ${week.value} поста`
                            : ["Pascha", "Penticostarion"].includes(week.type)
                                ? `Неделя ${week.value} по ${week.type === "Pascha" ? "Пасхе" : "Пятидесятнице"}`
                                : week.label}
                    </p>
                    <div className="flex flex-col space-y-1">
                        <Link
                            href={`/admin/weeks/${week._id.toString()}`}
                            className="cursor-pointer"
                        >
                            {week._id.toString()} {week.alias && `(${week.alias})`}
                        </Link>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default Content;

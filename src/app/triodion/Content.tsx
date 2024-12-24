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
            <h1>Уставные чтения Постной Триоди</h1>
            {items.map((week: any) => (
                <div key={week.id} className="flex flex-row mb-4">
                    <p className="text-slate-400 w-36 font-serif">
                        {week.type === "Fast" ? `Неделя ${week.value} Великоо поста` : week.label}
                    </p>
                    <div className="flex flex-col space-y-1">
                        {week.days.map((day: any) => (
                            <Link
                                key={day.id}
                                href={`/triodion/${day.alias || day.id}`}
                                className="cursor-pointer font-serif"
                            >
                                {day.name || day.alias || day.id}
                            </Link>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default Content;

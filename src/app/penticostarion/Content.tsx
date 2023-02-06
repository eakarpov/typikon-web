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
            <h1>Уставные чтения Цветной Триоди</h1>
            {items.map((week: any) => (
                <div key={week.id} className="flex flex-row mb-4">
                    <p className="text-slate-400 w-36">
                        Неделя {week.value} по {week.type === "Pascha" ? "Пасхе" : "Пятидесятнице"}
                    </p>
                    <div className="flex flex-col space-y-1">
                        {week.days.map((day: any) => (
                            <Link
                                key={day.id}
                                href={`/penticostarion/${day.alias || day.id}`}
                                className="cursor-pointer"
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

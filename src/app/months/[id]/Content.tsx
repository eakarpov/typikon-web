import Link from "next/link";

const Month = async ({ itemPromise }: any) => {
    const [item, error] = await itemPromise;

    if (!item || error) {
        return (
            <div>
                <p>
                    Данные не получены. Редактирование недоступно.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col">
            <p>
                Месяц {item.value}
            </p>
            {item.days.map((day: any) => (
                <div className="flex flex-row mb-4" key={day.id}>
                    <p className="text-slate-400 w-36">
                        {day.name || "Нет названия"}
                    </p>
                    <div className="flex flex-col space-y-1 w-60">
                        <Link
                            href={`/calendar/${day.alias || day.id}`}
                            className="cursor-pointer"
                        >
                            {day.alias || day.id}
                        </Link>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default Month;

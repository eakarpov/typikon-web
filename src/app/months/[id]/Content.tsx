import Link from "next/link";
import {getMonthLabel} from "@/lib/common/date";

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
            <p className="font-bold font-serif">
                Месяц: {getMonthLabel(item.value - 1)}
            </p>
            <p className="font-serif">
                Все даты заданы по старому стилю.
            </p>
            {item.days.map((day: any) => (
                <div className="flex flex-row mb-4" key={day.id}>
                    <Link
                        href={`/calendar/${day.alias || day.id}`}
                        className="cursor-pointer w-36 font-serif"
                    >
                        {day.name || "Нет названия"}
                    </Link>

                    <div className="flex flex-col space-y-1 w-60">
                        <p className="text-slate-400 font-serif">
                            {day.alias || day.id}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default Month;

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
            <h1 className="font-serif font-bold">Уставные чтения вне Триодного цикла</h1>
            <div className="pt-2 font-serif">
                <p>
                    Данный раздел на сегодня в разработке.
                </p>
                <p>
                    В данном разделе будет информация об уставных чтения с начала Петрова поста до недели о мытаре и фарисее.<br/><br/>
                </p>
                <p>
                    Внетриодный период года подразделяется на три этапа:
                </p>
                <ul>
                    <li>
                        1. От недели всех святых до Крестовоздвижения. В этот период читаются толкования на Евангелие от Матфея (за 2 месяца) и соборные послания апостольские. Если Пасха ранняя, то в промежуток до Крестовоздвижения после чтения толкований на Евангелия от Матфея читается толкование Евангелия от Марка.
                    </li>
                    <li>
                        2. От Крестовоздвижения до предпразднства Рождества (начало святых богоявлений). В этот период читаются толкования на Евангелие от Луки и послания святого апостола Павла, а также Маргарит и Метафраст Логофетов.
                    </li>
                    <li>
                        3. От предпразднства Рождества (от святых богоявлений) до Сырной седмицы. В период святых Богоялений читаются 12 бесед на Евангелие от Матфея. И скончаются в Сырную седмицу, где Триодь вытесняет прошлый пасхальный круг чтений.
                    </li>
                </ul>
            </div>

            {items.map((week: any) => (
                <div key={week.id} className="flex flex-row mb-4">
                    <p className="text-slate-400 font-serif">
                        {week.type === "first"
                            ? `Неделя ${week.value} по Пятидесятнице`
                            : week.type === "second"
                                ? week.label || `Неделя ${week.value} по Крестовоздвижении`
                                : week.type === "third"
                                    ? week.label || `Неделя ${week.value} по Богоявлении`
                                    : ""
                        }
                    </p>
                    <div className="flex flex-col space-y-1">
                        {week.days.map((day: any) => (
                            <Link
                                key={day.id}
                                href={`/weeks/${day.alias || day.id}`}
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

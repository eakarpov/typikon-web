import Link from "next/link";

export const getMonth = (value: number) => {
  switch (value) {
      case 0:
          return "Январь";
      case 1:
          return "Февраль";
      case 2:
          return "Март";
      case 3:
          return "Апрель";
      case 4:
          return "Май";
      case 5:
          return "Июнь";
      case 6:
          return "Июль";
      case 7:
          return "Август";
      case 8:
          return "Сентябрь";
      case 9:
          return "Октябрь";
      case 10:
          return "Ноябрь";
      case 11:
          return "Декабрь";
      default:
          return "";
  }
};

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
                Месяц: {getMonth(item.value - 1)}
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

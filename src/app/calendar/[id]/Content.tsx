import DayFullContent from "@/app/components/DayFullContent";
import {DayDTO} from "@/types/dto/days";
import {ArrowLeftIcon, ArrowRightIcon} from "@heroicons/react/24/outline";
import {getZeroedNumber} from "@/utils/dates";
import Link from "next/link";
import {getMonth, getMonthLabel} from "@/lib/common/date";
import OfflineSave from "@/app/components/save/OfflineSave";

const getMonthDateNext = (monthId: number, monthIndex: number) => {
  const date = new Date();
  date.setMonth(monthId - 1);
  date.setDate(monthIndex);
  const tomorrow = new Date(+date + 1000 * 60 * 60 * 24);
  return {
      month: tomorrow.getMonth() + 1,
      day: tomorrow.getDate(),
  };
};

const getMonthDatePrev = (monthId: number, monthIndex: number) => {
    const date = new Date();
    date.setMonth(monthId - 1);
    date.setDate(monthIndex);
    const yesterday = new Date(+date - 1000 * 60 * 60 * 24);
    return {
        month: yesterday.getMonth() + 1,
        day: yesterday.getDate(),
    };
};

const Content = async ({ itemPromise }: { itemPromise: Promise<[DayDTO, string]> }) => {

    const [item, error] = await itemPromise;

    if (!item || error) {
        return (
            <div>
                Ничего не нашлось
            </div>
        );
    }

    const prevData = getMonthDatePrev(item.month.value, item.monthIndex!);
    const nextData = getMonthDateNext(item.month.value, item.monthIndex!);

    return (
        <div className="flex flex-col">
            <div className="flex flex-row justify-center font-serif">
                <Link href={`/calendar/${getMonth(prevData.month)}-${getZeroedNumber(prevData.day)}`}>
                    <p className="flex flex-row items-center cursor-pointer">
                        <ArrowLeftIcon className="w-4 h-4" /> День назад
                    </p>
                </Link>
                <p className="mr-4 ml-4">
                    <b>Чтение на день: {getMonthLabel(item.month.value - 1)}, {item.monthIndex} число (старый стиль)</b>
                </p>
                <Link href={`/calendar/${getMonth(nextData.month)}-${getZeroedNumber(nextData.day)}`}>
                    <p className="flex flex-row items-center cursor-pointer">
                        День вперед <ArrowRightIcon className="w-4 h-4" />
                    </p>
                </Link>
            </div>
            {/* Тексты чтений выведены на самой странице дня, поэтому отложить
                достаточно её одну — за отдельными чтениями ходить не надо. */}
            <div className="flex flex-row justify-center pt-1">
                <OfflineSave
                    label={`Чтения на день: ${getMonthLabel(item.month.value - 1)}, ${item.monthIndex} число`}
                />
            </div>
            <DayFullContent item={item} />
        </div>
    );
};

export default Content;

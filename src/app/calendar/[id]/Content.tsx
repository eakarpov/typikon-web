import {TextType} from "@/utils/texts";
import DayTitle from "@/app/components/DayTitle";
import DayPartReading from "@/app/components/DayPartReading";
import {DayDTO} from "@/types/dto/days";
import {ArrowLeftIcon, ArrowRightIcon} from "@heroicons/react/24/outline";
import {getZeroedNumber} from "@/utils/dates";
import Link from "next/link";
import {getMonth, getMonthLabel} from "@/lib/common/date";

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
            <div className="flex flex-col pt-2 md:flex-row">
                <div className="w-1/4">
                    <ul className="space-y-2">
                        <DayTitle value={item.vigil} valueName={TextType.VIGIL} />
                        <DayTitle value={item.kathisma1} valueName={TextType.KATHISMA_1} />
                        <DayTitle value={item.kathisma2} valueName={TextType.KATHISMA_2} />
                        <DayTitle value={item.kathisma3} valueName={TextType.KATHISMA_3} />
                        <DayTitle value={item.ipakoi} valueName={TextType.IPAKOI} />
                        <DayTitle value={item.polyeleos} valueName={TextType.POLYELEOS} />
                        <DayTitle value={item.song3} valueName={TextType.SONG_3} />
                        <DayTitle value={item.song6} valueName={TextType.SONG_6} />
                        <DayTitle value={item.apolutikaTroparia} valueName={TextType.APOLUTIKA_TROPARIA} />
                        <DayTitle value={item.before1h} valueName={TextType.BEFORE_1h} />
                        <DayTitle value={item.panagia} valueName={TextType.PANAGIA} />
                    </ul>
                </div>
                <div className="flex flex-col flex-1 space-y-4">
                    <DayPartReading value={item.vigil} valueName={TextType.VIGIL} />
                    <DayPartReading value={item.kathisma1} valueName={TextType.KATHISMA_1} />
                    <DayPartReading value={item.kathisma2} valueName={TextType.KATHISMA_2} />
                    <DayPartReading value={item.kathisma3} valueName={TextType.KATHISMA_3} />
                    <DayPartReading value={item.ipakoi} valueName={TextType.IPAKOI} />
                    <DayPartReading value={item.polyeleos} valueName={TextType.POLYELEOS} />
                    <DayPartReading value={item.song3} valueName={TextType.SONG_3} />
                    <DayPartReading value={item.song6} valueName={TextType.SONG_6} />
                    <DayPartReading value={item.before1h} valueName={TextType.BEFORE_1h} />
                    <DayPartReading value={item.apolutikaTroparia} valueName={TextType.APOLUTIKA_TROPARIA} />
                    <DayPartReading value={item.panagia} valueName={TextType.PANAGIA} />
                    <DayPartReading value={item.h3} valueName={TextType.H3} />
                    <DayPartReading value={item.h6} valueName={TextType.H6} />
                    <DayPartReading value={item.h9} valueName={TextType.H9} />
                </div>
            </div>
        </div>
    );
};

export default Content;

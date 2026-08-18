import DayFullContent from "@/app/components/DayFullContent";
import DayMemories from "@/app/components/DayMemories";
import {ICalcDayResult} from "@/lib/calcDay";
import {ArrowLeftIcon, ArrowRightIcon} from "@heroicons/react/24/outline";
import Link from "next/link";
import {formatDateISO} from "@/utils/dates";
import {csFont, myFont} from "@/utils/font";

const Content = async ({ date, resultPromise }: { date: string; resultPromise: Promise<ICalcDayResult | null> }) => {
    const result = await resultPromise;

    const dateObj = new Date(date);
    const prevDate = formatDateISO(new Date(+dateObj - 1000 * 60 * 60 * 24));
    const nextDate = formatDateISO(new Date(+dateObj + 1000 * 60 * 60 * 24));

    return (
        <div className={`${myFont.variable} ${csFont.variable} flex flex-col`}>
            <div className="flex flex-row justify-center font-serif">
                <Link href={`/calculator/${prevDate}`}>
                    <p className="flex flex-row items-center cursor-pointer">
                        <ArrowLeftIcon className="w-4 h-4" /> День назад
                    </p>
                </Link>
                <p className="mr-4 ml-4 text-center">
                    <b>
                        Чтения на день: {date}
                        {result?.day?.name ? ` — ${result.day.name}` : ""}
                    </b>
                    {result && (
                        <span className="block text-sm font-normal">
                            Число по старому стилю: {new Date(result.date).toLocaleDateString()}
                        </span>
                    )}
                </p>
                <Link href={`/calculator/${nextDate}`}>
                    <p className="flex flex-row items-center cursor-pointer">
                        День вперёд <ArrowRightIcon className="w-4 h-4" />
                    </p>
                </Link>
            </div>
            {!result ? (
                <div>Ничего не нашлось на эту дату</div>
            ) : (
                <>
                    <DayMemories memories={result.memories} />
                    <DayFullContent item={result.day} paschal />
                </>
            )}
        </div>
    );
};

export default Content;

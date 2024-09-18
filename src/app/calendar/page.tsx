import {getItems} from "@/app/calendar/api";
import {Suspense} from "react";
import Content from "@/app/calendar/Content";
import {setMeta} from "@/lib/meta";
import {Metadata} from "next";

export const metadata: Metadata = {
    title: "Чтения на календарный день",
    description: 'Уставные чтения на выбранный календарный день.',
    openGraph: {
        title: 'Чтения на календарный день',
        description: 'Уставные чтения на выбранный календарный день.',
        url: "//www.typikon.su/calendar/"
    },
}

const Calendar = () => {
    const itemsData = getItems();
    setMeta();

    return (
        <div className="pt-2">
            <h1>
                Уставные чтения на календарный день по выбранному числу. В чтения входят Пролог и похвальные слова на памяти святым или неподвижным праздникам.
            </h1>
            <div className="border-1 rounded-sm">
                <a href="/calendar/today" className="font-bold">Чтения на сегодня</a>
            </div>
            <Suspense fallback={<div>Loading...</div>}>
                {/* @ts-expect-error Async Server Component */}
                <Content itemsPromise={itemsData} />
            </Suspense>
        </div>
    );
};

export default Calendar;

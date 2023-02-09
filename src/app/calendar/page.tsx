import {getItems} from "@/app/calendar/api";
import {Suspense} from "react";
import Content from "@/app/calendar/Content";

const Calendar = () => {
    const itemsData = getItems();

    return (
        <div className="pt-2">
            <p>
                Данный раздел на сегодня в разработке. На данный момент загружаются календарные чтения по периоду цветной триоди - с 30 марта (самый ранний понедельник второй седмицы по Пасхе) по 20 июня (самая поздняя неделя всех святых)
            </p>
            <h1>
                Уставные чтения на календарный день по выбранному числу. В чтения входят Пролог и похвальные слова на памяти святым или неподвижным праздникам.
            </h1>
            <Suspense fallback={<div>Loading...</div>}>
                {/* @ts-expect-error Async Server Component */}
                <Content itemsPromise={itemsData} />
            </Suspense>
        </div>
    );
};

export default Calendar;

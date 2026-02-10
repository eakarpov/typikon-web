'use client';
import React, {useCallback, useState} from "react";
import {useRouter} from "next/navigation";
import {getMonth} from "@/lib/common/date";

const now = new Date();
const currMonthStr = now.getMonth() + 1 > 9 ? now.getMonth() + 1 :  `0${now.getMonth() + 1}`;

const DateCalendar = () => {
    const [value, setValue] = useState(
        `${now.getFullYear()}-${currMonthStr}-${now.getDate() >= 10 ? now.getDate() : `0${now.getDate()}`}`
    );

    const router = useRouter();

    const onGoToDate = useCallback(() => {
        const [, month, date] = value.split("-");
        const monthStr = getMonth(parseInt(month, 10));
        router.push(`/calendar/${monthStr}-${date}`);
    }, [value, router]);

    return (
        <div className="w-fit pr-2 font-serif">
            <label className="pr-2">
                Перейти сразу к дате
            </label>
            <input
                type="date"
                value={value}
                onChange={e => setValue(e.target.value)}
            />
            <span className="cursor-pointer font-bold" onClick={onGoToDate}>
                Перейти -&gt;
            </span>
        </div>
    )
};

export default DateCalendar;

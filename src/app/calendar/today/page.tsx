import {getItem} from "@/app/calendar/today/api";
import {Suspense} from "react";
import Content from "@/app/calendar/today/Content";
import {myFont} from "@/utils/font";
import {setMeta} from "@/lib/meta";
import {getTodayDate, getZeroedNumber} from "@/utils/dates";

const AdminTextId = async () => {
    setMeta();

    const itemPromise = getItem();
    const d = getTodayDate();
    const day = d.getDate();
    const month = d.getMonth() + 1;
    return (
        <div>
            <h1 className="font-bold">
                Календарные тексты для чтения на сегодня ({getZeroedNumber(day)}.{getZeroedNumber(month)} по старому стилю)
            </h1>
            <div className={myFont.variable}>
                <Suspense fallback={<div>Loading...</div>}>
                    {/* @ts-expect-error Async Server Component */}
                    <Content itemPromise={itemPromise} />
                </Suspense>
            </div>
        </div>
    );
};

export default AdminTextId;

import {getItem} from "@/app/calendar/today/api";
import {Suspense} from "react";
import Content from "@/app/calendar/today/Content";
import {myFont} from "@/utils/font";

const AdminTextId = async () => {
    const itemPromise = getItem();
    const d = new Date(+new Date() - 1000 * 60 * 60 * 24 * 13);
    const day = d.getDate();
    const month = d.getMonth() + 1;
    return (
        <div>
            <h1 className="font-bold">
                Календарные тексты для чтения на сегодня ({day}.{month} по старому стилю)
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

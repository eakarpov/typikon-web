import {Metadata} from "next";
import {myFont} from "@/utils/font";
import {Suspense} from "react";
import Content from "@/app/rest-readings/Content";
import {getItems} from "@/app/rest-readings/api";

export const metadata: Metadata = {
    title: "Чтения на год",
    description: "Уставные чтения вне триодных периодов Постной и Цветной Триодей.",
    openGraph: {
        title: "Чтения на год",
        description: "Уставные чтения вне триодных периодов Постной и Цветной Триодей.",
        url: "//www.typikon.su/rest-readings/",
        type: "website",
    },
};

const RestReadings = () => {
    const itemsData = getItems();

    return (
        <div>
            <div className={myFont.variable}>
                <Suspense fallback={<div>Loading...</div>}>
                    {/* @ts-expect-error Async Server Component */}
                    <Content itemsPromise={itemsData} />
                </Suspense>
            </div>
        </div>
    );
};

export default RestReadings;

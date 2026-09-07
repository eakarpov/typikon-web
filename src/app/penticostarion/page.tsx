import { Suspense } from "react";
import Content from "@/app/penticostarion/Content";
import {getItems} from "@/app/penticostarion/api";
import {myFont} from "@/utils/font";
import {Metadata} from "next";
import { SITE_URL } from "@/utils/site";

// Страница не читает cookies и не зависит от пользователя — держим её в ISR-кэше.
export const revalidate = 3600;

export const metadata: Metadata = {
    title: "Цветная Триодь",
    description: "Уставные чтения на святую Пятидесятницу и неделю всех святых.",
    openGraph: {
        title: "Цветная Триодь",
        description: "Уставные чтения на святую Пятидесятницу и неделю всех святых.",
        url: `${SITE_URL}/penticostarion/`,
        type: "website",
    },
};

const Penticostarion = async () => {
    const itemsData = getItems();

    return (
        <div className="pt-2">
            <div className={myFont.variable}>
                <p className="font-serif">
                    В данном разделе вы можете найти информацию по уставным чтениям в период с Пасхи до недели всех святых.
                </p>
            </div>
            <div className={myFont.variable}>
                <Suspense fallback={<div>Loading...</div>}>
                    <Content itemsPromise={itemsData} />
                </Suspense>
            </div>
        </div>
    );
};

export default Penticostarion;

import {Metadata} from "next";
import {myFont} from "@/utils/font";
import {Suspense} from "react";
import Content from "@/app/commons/Content";
import {getItems} from "@/app/commons/api";
import { SITE_URL } from "@/utils/site";

// Страница не читает cookies и не зависит от пользователя — держим её в ISR-кэше.
export const revalidate = 3600;

export const metadata: Metadata = {
    title: "Общие службы",
    description: "Чтения общие по чину святого — используются при отсутствии собственных чтений дня.",
    openGraph: {
        title: "Общие службы",
        description: "Чтения общие по чину святого — используются при отсутствии собственных чтений дня.",
        url: `${SITE_URL}/commons/`,
        type: "website",
    },
};

const Commons = () => {
    const itemsData = getItems();

    return (
        <div>
            <div className={myFont.variable}>
                <Suspense fallback={<div>Loading...</div>}>
                    <Content itemsPromise={itemsData} />
                </Suspense>
            </div>
        </div>
    );
};

export default Commons;

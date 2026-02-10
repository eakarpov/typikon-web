import {Metadata} from "next";
import {myFont} from "@/utils/font";
import {Suspense} from "react";
import Content from "@/app/signs/Content";
import {getItems} from "@/app/signs/api";

export const metadata: Metadata = {
    title: "Памяти по знаку Типикона",
    description: "Список памятей по знаку Типикона.",
    openGraph: {
        title: "Памяти по знаку Типикона",
        description: "Список памятей по знаку Типикона.",
        url: "//www.typikon.su/signs/",
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

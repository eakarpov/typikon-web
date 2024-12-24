import {getItems} from "@/app/triodion/api";
import {myFont} from "@/utils/font";
import {Suspense} from "react";
import Content from "@/app/triodion/Content";
import {Metadata} from "next";

export const metadata: Metadata = {
    title: "Уставные чтения Постной Триоди",
    description: "Уставные чтения с недели о мытаре и фарисее до пасхальной заутрени.",
    openGraph: {
        title: "Уставные чтения Постной Триоди",
        description: "Уставные чтения с недели о мытаре и фарисее до пасхальной заутрени.",
        url: "//www.typikon.su/triodion/",
        type: "website",
    },
}

const Triodion = () => {
    const itemsData = getItems();

    return (
        <div className="pt-2">
            <div className={myFont.variable}>
                <p className="font-serif">
                    Данный раздел на сегодня в разработке.
                </p>
                <p className="font-serif">
                    В данном разделе будет информация о чтениях триодного цикла с недели о мытаре и фарисее и до пасхальной заутрени (полунощницы).
                </p>
            </div>
            <div className={myFont.variable}>
                <Suspense fallback={<div>Loading...</div>}>
                    {/* @ts-expect-error Async Server Component */}
                    <Content itemsPromise={itemsData} />
                </Suspense>
            </div>
        </div>
    );
};

export default Triodion;

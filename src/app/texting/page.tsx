import Content from "@/app/texting/Content";
import {Suspense} from "react";
import {getItems} from "@/app/texting/api";
import {setMeta} from "@/lib/meta";
import {Metadata} from "next";
import {myFont} from "@/utils/font";

export const metadata: Metadata = {
    title: "Отекстовка",
    description: "Помогите отекстовать документы, которым это нужнее всего.",
    openGraph: {
        title: "Отекстовка",
        description: "Помогите отекстовать документы, которым это нужнее всего.",
        url: "//www.typikon.su/texting/"
    },
}

const Texting = async () => {
    const itemsData = getItems();
    setMeta();

    return (
        <div className="pt-2">
            <div className={myFont.variable}>
                <p className="font-serif">
                    Здесь собраны документы, которым в первую очередь нужна отекстовка — перевод
                    скана источника в цифровой текст. Выберите документ, ознакомьтесь со сканом и
                    предложите свой вариант текста — после проверки администратором он попадёт на сайт.
                </p>
                <Suspense fallback={<div>Loading...</div>}>
                    {/* @ts-expect-error Async Server Component */}
                    <Content itemsPromise={itemsData} />
                </Suspense>
            </div>
        </div>
    );
};

export default Texting;

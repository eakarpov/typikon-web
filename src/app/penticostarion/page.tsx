import { Suspense } from "react";
import Content from "@/app/penticostarion/Content";
import {getItems} from "@/app/penticostarion/api";
import {myFont} from "@/utils/font";
import {setMeta} from "@/lib/meta";

const Penticostarion = async () => {
    const itemsData = getItems();
    setMeta();

    return (
        <div className="pt-2">
            <p>
                Данный раздел на сегодня в разработке. Готово 100% текстов. Будет выкладываться постепенно.
            </p>
            <p>
                В данном разделе будет информация об уставных чтений с Пасхи до недели всех святых.
            </p>
            <div className={myFont.variable}>
                <Suspense fallback={<div>Loading...</div>}>
                    {/* @ts-expect-error Async Server Component */}
                    <Content itemsPromise={itemsData} />
                </Suspense>
            </div>
        </div>
    );
};

export default Penticostarion;

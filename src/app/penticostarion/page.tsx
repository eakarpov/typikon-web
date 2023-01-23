import { Suspense } from "react";
import Content from "@/app/penticostarion/Content";
import {getItems} from "@/app/penticostarion/api";

const Penticostarion = async () => {
    const itemsData = getItems();

    return (
        <div className="pt-2">
            <p>
                Данный раздел на сегодня в разработке. Готово примерно 70% текстов. Будет выкладываться постепенно.
            </p>
            <p>
                В данном разделе будет информация об уставных чтений с Пасхи до недели всех святых.
            </p>
            <Suspense fallback={<div>Loading...</div>}>
                {/* @ts-expect-error Async Server Component */}
                <Content itemsPromise={itemsData} />
            </Suspense>
        </div>
    );
};

export default Penticostarion;

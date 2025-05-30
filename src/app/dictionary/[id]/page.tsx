import {myFont} from "@/utils/font";
import {Suspense} from "react";
import Content from "@/app/dictionary/[id]/Content";
import {getItem} from "@/app/dictionary/[id]/api";

const DictionaryItem = ({ params: { id }}: { params: { id: string }}) => {
    const data = getItem(id);

    return (
        <div className={myFont.variable}>
            <Suspense fallback={<div>Loading...</div>}>
                {/* @ts-expect-error Async Server Component */}
                <Content itemsPromise={data} />
            </Suspense>
        </div>
    )
}

export default DictionaryItem;

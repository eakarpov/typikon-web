import {setMeta} from "@/lib/meta";
import {getDneslovObject, getItems, getMentions} from "@/app/saints/[id]/api";
import Content from "@/app/saints/[id]/Content";
import {Suspense} from "react";
import {myFont} from "@/utils/font";

const SaintItem = ({ params: { id }}: { params: { id: string }}) => {
    setMeta();
    const itemPromise = Promise.allSettled([getItems(id), getDneslovObject(id), getMentions(id)]);

    return (
        <div className={myFont.variable}>
            <Suspense fallback={<div>Loading...</div>}>
                {/* @ts-expect-error Async Server Component */}
                <Content itemPromise={itemPromise} />
            </Suspense>
        </div>
    )
};

export default SaintItem;

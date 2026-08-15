import {getItem} from "@/app/texting/[id]/api";
import Content from "@/app/texting/[id]/Content";
import {Suspense} from "react";
import {myFont} from "@/utils/font";
import {setMeta} from "@/lib/meta";

const TextingItem = ({ params: { id } }: { params: { id: string } }) => {
    setMeta();
    const itemPromise = getItem(id);

    return (
        <div className={myFont.variable}>
            <Suspense fallback={<div>Loading...</div>}>
                {/* @ts-expect-error Async Server Component */}
                <Content itemPromise={itemPromise} id={id} />
            </Suspense>
        </div>
    );
};

export default TextingItem;

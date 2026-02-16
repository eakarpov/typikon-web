import {setMeta} from "@/lib/meta";
import {getItem} from "@/app/signs/[id]/api";
import Content from "@/app/signs/[id]/Content";
import {Suspense} from "react";

const PlaceItem = ({ params: { id }}: { params: { id: string }}) => {
    setMeta();
    const itemPromise = getItem(id);

    return (
        <Suspense fallback={<div>Loading...</div>}>
            {/* @ts-expect-error Async Server Component */}
            <Content itemPromise={itemPromise} />
        </Suspense>
    )
};

export default PlaceItem;

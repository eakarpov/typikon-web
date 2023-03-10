import Content from "@/app/library/[id]/Content";
import {Suspense} from "react";
import {getItem} from "@/app/library/[id]/api";
import {myFont} from "@/utils/font";

const Library = async ({ params: { id }}: { params: {id: string}}) => {
    const itemPromise = getItem(id);

    return (
        <div className={myFont.variable}>
            <Suspense fallback={<div>Loading...</div>}>
                {/* @ts-expect-error Async Server Component */}
                <Content itemPromise={itemPromise} />
            </Suspense>
        </div>
    );
};

export default Library;

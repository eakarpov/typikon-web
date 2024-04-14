import {getItem} from "@/app/months/[id]/api";
import {Suspense} from "react";
import Content from "@/app/months/[id]/Content";
import {setMeta} from "@/lib/meta";

const MonthPage = async ({ params: { id }}: { params: { id: string }}) => {
    const itemPromise = getItem(id);
    setMeta();

    return (
        <div>
            <Suspense fallback={<div>Loading...</div>}>
                {/* @ts-expect-error Async Server Component */}
                <Content itemPromise={itemPromise} />
            </Suspense>
        </div>
    );
};

export default MonthPage;

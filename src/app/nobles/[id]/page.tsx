import {getItem} from "@/app/nobles/[id]/api";
import {Suspense} from "react";
import Content from "@/app/nobles/[id]/Content";
import {myFont} from "@/utils/font";

const MonthPage = async ({ params: { id }}: { params: { id: string }}) => {
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

export default MonthPage;

import {getItem} from "@/app/calendar/[id]/api";
import {Suspense} from "react";
import Content from "@/app/calendar/[id]/Content";
import {myFont} from "@/utils/font";

const AdminTextId = async ({ params: { id }}: { params: { id: string }}) => {
    const itemPromise = getItem(id);
    return (
        <div>
            <p>
                Это страница элемента
            </p>
            <div className={myFont.variable}>
                <Suspense fallback={<div>Loading...</div>}>
                    {/* @ts-expect-error Async Server Component */}
                    <Content itemPromise={itemPromise} />
                </Suspense>
            </div>
        </div>
    );
};

export default AdminTextId;

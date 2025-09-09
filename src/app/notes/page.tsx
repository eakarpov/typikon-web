import {getItem} from "@/app/months/[id]/api";
import {setMeta} from "@/lib/meta";
import {myFont} from "@/utils/font";
import {Suspense} from "react";
import Content from "@/app/months/[id]/Content";
import {getItems} from "@/app/notes/api";

const NotesPage = async () => {
    const itemPromise = getItems();
    setMeta();

    return (
        <div className={myFont.variable}>
            <Suspense fallback={<div>Loading...</div>}>
                {/* @ts-expect-error Async Server Component */}
                <Content itemPromise={itemPromise} />
            </Suspense>
        </div>
    );
};

export default NotesPage;

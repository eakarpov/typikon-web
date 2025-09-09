import {Suspense} from "react";
import Content from "@/app/notes/Content";
import { searchData } from "./api";
import {myFont} from "@/utils/font";

const Notes = (req: { searchParams: { query?: string; }}) => {
    const data = searchData(req.searchParams.query);

    return (
        <div className={myFont.variable}>
            <Suspense fallback={<div>Loading...</div>}>
                {/* @ts-expect-error Async Server Component */}
                <Content itemsPromise={data} />
            </Suspense>
        </div>
    )
};

export default Notes;

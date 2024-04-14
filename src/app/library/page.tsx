import Content from "@/app/library/Content";
import {Suspense} from "react";
import {getItems} from "@/app/library/api";
import {setMeta} from "@/lib/meta";

const Library = async () => {
    const itemsData = getItems();
    setMeta();

    return (
        <div className="pt-2">
            <p>
                Данный раздел на сегодня в разработке.
            </p>
            <p>
                В данном разделе будет организован доступ к отекстованным книгам в целом по содержанию без привязки к дате.
            </p>
            <Suspense fallback={<div>Loading...</div>}>
                {/* @ts-expect-error Async Server Component */}
                <Content itemsPromise={itemsData} />
            </Suspense>
        </div>
    );
};

export default Library;

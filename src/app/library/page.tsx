import Content from "@/app/library/Content";
import {Suspense} from "react";
import {getItems} from "@/app/library/api";
import {setMeta} from "@/lib/meta";
import {Metadata} from "next";
import {myFont} from "@/utils/font";

export const metadata: Metadata = {
    title: "Библиотека текстов",
    description: 'Уставные чтения, объединенные в книги для полного прочтения.',
    openGraph: {
        title: 'Библиотека текстов',
        description: 'Уставные чтения, объединенные в книги для полного прочтения.',
        url: "//www.typikon.su/library/"
    },
}

const Library = async () => {
    const itemsData = getItems();
    setMeta();

    return (
        <div className="pt-2">
            <div className={myFont.variable}>
                <p className="font-serif">
                    В данном разделе будет организован доступ к отекстованным книгам в целом по содержанию без привязки к дате.
                </p>
                <Suspense fallback={<div>Loading...</div>}>
                    {/* @ts-expect-error Async Server Component */}
                    <Content itemsPromise={itemsData} />
                </Suspense>
            </div>
        </div>
    );
};

export default Library;

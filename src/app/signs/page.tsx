import {Metadata} from "next";
import {myFont} from "@/utils/font";
import {Suspense} from "react";
import Content from "@/app/signs/Content";
import {getItems} from "@/app/signs/api";

export const metadata: Metadata = {
    title: "Памяти по знаку Типикона",
    description: "Список памятей по знаку Типикона.",
    openGraph: {
        title: "Памяти по знаку Типикона",
        description: "Список памятей по знаку Типикона.",
        url: "//www.typikon.su/signs/",
        type: "website",
    },
};

interface ISearchParams {
    page?: string;
    q?: string;
    month?: string;
}

const RestReadings = ({ searchParams }: { searchParams: ISearchParams }) => {
    const itemsData = getItems({
        page: searchParams.page ? parseInt(searchParams.page, 10) : 1,
        q: searchParams.q || undefined,
        month: searchParams.month ? parseInt(searchParams.month, 10) : undefined,
    });

    return (
        <div>
            <div className={myFont.variable}>
                <Suspense fallback={<div>Loading...</div>}>
                    {/* @ts-expect-error Async Server Component */}
                    <Content itemsPromise={itemsData} searchParams={searchParams} />
                </Suspense>
            </div>
        </div>
    );
};

export default RestReadings;

import Content from "@/app/library/[id]/Content";
import {Suspense} from "react";
import {getItem} from "@/app/library/[id]/api";
import {myFont} from "@/utils/font";
import {setMeta} from "@/lib/meta";
import {Metadata} from "next";

type Props = {
    params: { id: string }
}

export async function generateMetadata(
    { params }: Props,
): Promise<Metadata> {
    // read route params
    const id = params.id

    // fetch data
    const [item] = await getItem(id);

    return {
        title: `${item?.name} ${item?.author ? `(${item?.author})` : ""}`,
        description: `Уставные чтения. ${item?.author ? `Автор: (${item?.author})` : ""}. Название: ${item?.name}`,
        openGraph: {
            title: `${item?.name} ${item?.author ? `(${item?.author})` : ""}`,
            type: "website",
            url: `//www.typikon.su/library/${id}`,
            description: `Уставные чтения. ${item?.author ? `Автор: (${item?.author})` : ""}. Название: ${item?.name}`
        },
    }
}

const Library = async ({ params: { id }}: { params: {id: string}}) => {
    const itemPromise = getItem(id);
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

export default Library;

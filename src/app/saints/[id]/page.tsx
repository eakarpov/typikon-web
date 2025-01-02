import {setMeta} from "@/lib/meta";
import {getDneslovObject, getItems, getMentions} from "@/app/saints/[id]/api";
import Content from "@/app/saints/[id]/Content";
import {Suspense} from "react";
import {myFont} from "@/utils/font";
import {Metadata} from "next";

type Props = {
    params: { id: string }
}

export async function generateMetadata(
    { params }: Props,
): Promise<Metadata> {
    const id = params.id

    const [itemPromise] = await Promise.allSettled([getDneslovObject(id)]);

    const item = itemPromise.status === "fulfilled" && itemPromise.value;

    const lastMemo = Array.isArray(item?.memoes) && item.memoes[0];

    return {
        title: `Страница святого - ${lastMemo?.title || id}`,
        description: `Уставные чтения с упоминанием или авторством святого - ${lastMemo?.title || id}`,
        openGraph: {
            type: "website",
            url: `//www.typikon.su/saints/${id}`,
            title: `Страница святого - ${lastMemo?.title || id}`,
            description: `Уставные чтения с упоминанием или авторством святого - ${lastMemo?.title || id}`,
        },
    }
}

const SaintItem = ({ params: { id }}: { params: { id: string }}) => {
    setMeta();
    const itemPromise = Promise.allSettled([getItems(id), getDneslovObject(id), getMentions(id)]);

    return (
        <div className={myFont.variable}>
            <Suspense fallback={<div>Loading...</div>}>
                {/* @ts-expect-error Async Server Component */}
                <Content itemPromise={itemPromise} />
            </Suspense>
        </div>
    )
};

export default SaintItem;

import {setMeta} from "@/lib/meta";
import {getDneslovObject, getItems, getMentions} from "@/app/saints/[id]/api";
import Content from "@/app/saints/[id]/Content";
import {Suspense} from "react";
import {myFont} from "@/utils/font";
import {Metadata} from "next";
import {getItem} from "@/app/months/[id]/api";
import {getMonth} from "@/app/months/[id]/Content";


type Props = {
    params: { id: string }
}

export async function generateMetadata(
    { params }: Props,
): Promise<Metadata> {
    // read route params
    const id = params.id

    // fetch data // TODO: Ждем днеслова который вернет здесь имя святого
    // const [itemPromise] = await Promise.allSettled([getItems(id), getDneslovObject(id), getMentions(id)]);

    return {
        title: `Страница святого - ${id}`,
        description: `Уставные чтения с упоминанием или авторством святого - ${id}`,
        openGraph: {
            type: "website",
            url: `//www.typikon.su/saints/${id}`,
            title: `Страница святого - ${id}`,
            description: `Уставные чтения с упоминанием или авторством святого - ${id}`,
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

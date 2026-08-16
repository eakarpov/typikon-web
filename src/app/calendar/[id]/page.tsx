import {getItem} from "@/app/calendar/[id]/api";
import {Suspense} from "react";
import Content from "@/app/calendar/[id]/Content";
import {myFont} from "@/utils/font";
import {setMeta} from "@/lib/meta";
import {Metadata} from "next";
import {getMonth, getMonthLabel} from "@/lib/common/date";
import {cookies} from "next/headers";
import {BIBLE_LANGUAGE_COOKIE, DEFAULT_BIBLE_LANGUAGE} from "@/utils/bibleLanguage";

type Props = {
    params: { id: string }
}

export async function generateMetadata(
    { params }: Props,
): Promise<Metadata> {
    // read route params
    const id = params.id

    // fetch data
    const lang = (await cookies()).get(BIBLE_LANGUAGE_COOKIE)?.value || DEFAULT_BIBLE_LANGUAGE;
    const [item] = await getItem(id, lang);

    return {
        title: `Уставные чтения на день: ${getMonthLabel(item?.month.value - 1)}, ${item?.monthIndex} число`,
        description: `Список текстов с уставными чтениями на день: ${getMonthLabel(item?.month.value - 1)}, ${item?.monthIndex} число`,
        openGraph: {
            type: "website",
            url: `//www.typikon.su/calendar/${id}`,
            title: `Уставные чтения на день: ${getMonthLabel(item?.month.value - 1)}, ${item?.monthIndex} число`,
            description: `Список текстов с уставными чтениями на день: ${getMonthLabel(item?.month.value - 1)}, ${item?.monthIndex} число`,
        },
    }
}

const AdminTextId = async ({ params: { id }}: { params: { id: string }}) => {
    const lang = (await cookies()).get(BIBLE_LANGUAGE_COOKIE)?.value || DEFAULT_BIBLE_LANGUAGE;
    const itemPromise = getItem(id, lang);
    setMeta();

    return (
        <div>
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

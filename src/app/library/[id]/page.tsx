import Content from "@/app/library/[id]/Content";
import {Suspense} from "react";
import {getItem} from "@/app/library/[id]/api";
import {myFont} from "@/utils/font";
import {setMeta} from "@/lib/meta";
import {Metadata} from "next";

// Страница не читает cookies и не зависит от пользователя — держим её в ISR-кэше.
export const revalidate = 3600;

// Пустой список + dynamicParams по умолчанию: страницы книг генерируются по первому
// запросу и после этого лежат в ISR-кэше. Без generateStaticParams Next считает
// сегмент полностью динамическим и результат не кэширует вовсе.
export const generateStaticParams = async () => [] as { id: string }[];

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

    if (!item) {
        return {};
    }

    return {
        title: item.name,
        description: item.description ||
            `Уставные чтения. ${item?.author ? `Автор: (${item?.author})` : ""}. Название: ${item?.name}`,
        openGraph: {
            title: item.name,
            type: "website",
            url: `//www.typikon.su/library/${id}`,
            description: item.description ||
                `Уставные чтения. ${item?.author ? `Автор: (${item?.author})` : ""}. Название: ${item?.name}`
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

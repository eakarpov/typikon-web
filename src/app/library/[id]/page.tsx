import { canonicalPath, withSearch } from "@/lib/contentAliases";
import Content from "@/app/library/[id]/Content";
import {Suspense} from "react";
import {getBibleEditionCode, getItem} from "@/app/library/[id]/api";
import {permanentRedirect, redirect, notFound} from "next/navigation";
import {myFont} from "@/utils/font";
import {setMeta} from "@/lib/meta";
import {Metadata} from "next";
import { SITE_URL } from "@/utils/site";

// Страница не читает cookies и не зависит от пользователя — держим её в ISR-кэше.
export const revalidate = 3600;

// Пустой список + dynamicParams по умолчанию: страницы книг генерируются по первому
// запросу и после этого лежат в ISR-кэше. Без generateStaticParams Next считает
// сегмент полностью динамическим и результат не кэширует вовсе.
export const generateStaticParams = async () => [] as { id: string }[];

type Props = {
    params: { id: string }
    searchParams: Record<string, string | string[] | undefined>
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
        alternates: { canonical: `${SITE_URL}${canonicalPath("library", item)}` },
        description: item.description ||
            `Уставные чтения. ${item?.author ? `Автор: (${item?.author})` : ""}. Название: ${item?.name}`,
        openGraph: {
            title: item.name,
            type: "website",
            url: `${SITE_URL}${canonicalPath("library", item)}`,
            description: item.description ||
                `Уставные чтения. ${item?.author ? `Автор: (${item?.author})` : ""}. Название: ${item?.name}`
        },
    }
}

const Library = async ({ params: { id }, searchParams }: Props) => {
    // Оглавление издания Библии — по канону, и живёт оно в своём разделе.
    const [bibleCode] = await getBibleEditionCode(id);
    if (bibleCode) permanentRedirect(withSearch(`/bible?v=${bibleCode}`, searchParams));

    const result = await getItem(id);
    const [item, error] = result;
    if (error) throw error;
    if (!item) notFound();
    const path = canonicalPath("library", item);
    // Адрес редактор может вернуть или снять: постоянный редирект в браузере
    // тогда создал бы петлю. Канонический адрес указан отдельно в метаданных.
    if (path !== `/library/${id}`) redirect(withSearch(path, searchParams));
    const itemPromise = Promise.resolve(result);
    setMeta();

    return (
        <div className={myFont.variable}>
            <Suspense fallback={<div>Loading...</div>}>
                <Content itemPromise={itemPromise} />
            </Suspense>
        </div>
    );
};

export default Library;

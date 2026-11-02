import { canonicalPath, withSearch } from "@/lib/contentAliases";
import Content from "@/app/library/[id]/Content";
import {Suspense} from "react";
import {getBibleEditionCode, getItem} from "@/app/library/[id]/api";
import {permanentRedirect, redirect, notFound} from "next/navigation";
import {myFont} from "@/utils/font";
import {setMeta} from "@/lib/meta";
import {Metadata} from "next";
import {breadcrumbs, pageMetadata} from "@/lib/seo/metadata";
import {bookDescription, contentSchema} from "@/lib/seo/content";
import JsonLd from "@/app/components/JsonLd";

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
    const [item, error] = await getItem(params.id);
    if (error) throw error;
    if (!item) return { title: "Книга не найдена", robots: { index: false } };
    return pageMetadata({
        title: [item.name, item.author].filter(Boolean).join(" — "),
        description: bookDescription(item), path: canonicalPath("library", item),
        noindex: item.public === false,
    });
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
            {item.public !== false && <>
                <JsonLd data={contentSchema("library", item, bookDescription(item))} />
                <JsonLd data={breadcrumbs([{name: "Главная", path: "/"}, {name: "Библиотека", path: "/library"}, {name: item.name, path}])} />
            </>}

            <Suspense fallback={<div>Loading...</div>}>
                <Content itemPromise={itemPromise} />
            </Suspense>
        </div>
    );
};

export default Library;

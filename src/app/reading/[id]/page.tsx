import {notFound} from 'next/navigation';
import {selectedStatia} from '@/lib/readingParts';
import { canonicalPath, withSearch } from "@/lib/contentAliases";
import {getBibleRedirect, getItem} from "@/app/reading/[id]/api";
import Content from "@/app/reading/[id]/Content";
import {Suspense} from "react";
import {permanentRedirect, redirect} from "next/navigation";
import {myFont} from "@/utils/font";
import {setMeta} from "@/lib/meta";
import {Metadata} from "next";
import {breadcrumbs, pageMetadata} from "@/lib/seo/metadata";
import {contentSchema, readingTitle, readingDescription} from "@/lib/seo/content";
import JsonLd from "@/app/components/JsonLd";

type Props = {
    params: { id: string }
    searchParams: Record<string, string | string[] | undefined>
}

export async function generateMetadata(
    { params }: Props,
): Promise<Metadata> {
    const [item, error] = await getItem(params.id);
    if (error) throw error;
    if (!item) return { title: "Текст не найден", robots: { index: false } };
    return pageMetadata({
        title: readingTitle(item), description: readingDescription(item),
        path: canonicalPath("reading", item),
        noindex: !item.content?.trim() || item.public === false || item.bookPublic === false,
    });
}

const ReadingItem = async ({ params: { id }, searchParams }: Props) => {
    const { accents } = searchParams;
    // Библия переехала в собственный раздел, а её прежние адреса остались в карте
    // сайта и в чужих ссылках. Постоянный редирект, а не временный: адрес сменился
    // насовсем, и поисковикам надо об этом сказать прямо.
    const bible = await getBibleRedirect(id);
    if (bible) permanentRedirect(withSearch(bible, searchParams));

    setMeta();
    const result = await getItem(id);
    const [item, error, shouldRedirect] = result;
    if (error) throw error;
    if (!item) notFound();
    if (item && shouldRedirect) redirect(withSearch(canonicalPath("reading", item), searchParams));
    const fragment = searchParams.statia === undefined ? null : selectedStatia(item?.content || '', searchParams.statia);
    if(searchParams.statia !== undefined && !fragment)notFound();
    const itemPromise = Promise.resolve(result);

    return (
      <div className={myFont.variable}>
          {item.content?.trim() && item.public !== false && item.bookPublic !== false && <>
              <JsonLd data={contentSchema("reading", item, readingDescription(item))} />
              <JsonLd data={breadcrumbs([
                  {name: "Главная", path: "/"}, {name: "Библиотека", path: "/library"},
                  ...(item.bookId && item.bookName ? [{name: item.bookName, path: `/library/${item.bookAlias || item.bookId}`}] : []),
                  {name: item.name || "Чтение", path: canonicalPath("reading", item)},
              ])} />
          </>}

          <Suspense fallback={<div>Loading...</div>}>
              <Content itemPromise={itemPromise} showAccents={accents === "1"} statia={fragment?.statia} />
          </Suspense>
      </div>
    );
};

export default ReadingItem;

import { canonicalPath, withSearch } from "@/lib/contentAliases";
import {getBibleRedirect, getItem} from "@/app/reading/[id]/api";
import Content from "@/app/reading/[id]/Content";
import {Suspense} from "react";
import {permanentRedirect, redirect} from "next/navigation";
import {myFont} from "@/utils/font";
import {setMeta} from "@/lib/meta";
import {Metadata} from "next";
import { SITE_URL } from "@/utils/site";

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

    return {
        title: item?.name?.replaceAll('́', ''),
        alternates: { canonical: `${SITE_URL}${canonicalPath("reading", item || { id })}` },
        description: item?.description?.replaceAll('́', '') || `Уставные чтения на день: ${item?.name?.replaceAll('́', '')}`,
        openGraph: {
            type: "website",
            url: `${SITE_URL}${canonicalPath("reading", item || { id })}`,
            title: item?.name?.replaceAll('́', ''),
            description: item?.description?.replaceAll('́', '') || `Уставные чтения на день: ${item?.name?.replaceAll('́', '')}`,
        },
    }
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
    const [item, , shouldRedirect] = result;
    if (item && shouldRedirect) redirect(withSearch(canonicalPath("reading", item), searchParams));
    const itemPromise = Promise.resolve(result);

    return (
      <div className={myFont.variable}>
          <Suspense fallback={<div>Loading...</div>}>
              <Content itemPromise={itemPromise} showAccents={accents === "1"} />
          </Suspense>
      </div>
    );
};

export default ReadingItem;

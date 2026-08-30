import {getBibleRedirect, getItem} from "@/app/reading/[id]/api";
import Content from "@/app/reading/[id]/Content";
import {Suspense} from "react";
import {permanentRedirect} from "next/navigation";
import {myFont} from "@/utils/font";
import {setMeta} from "@/lib/meta";
import {Metadata} from "next";

type Props = {
    params: { id: string }
    searchParams: { range?: string; accents?: string }
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
        description: item?.description?.replaceAll('́', '') || `Уставные чтения на день: ${item?.name?.replaceAll('́', '')}`,
        openGraph: {
            type: "website",
            url: `//www.typikon.su/reading/${id}`,
            title: item?.name?.replaceAll('́', ''),
            description: item?.description?.replaceAll('́', '') || `Уставные чтения на день: ${item?.name?.replaceAll('́', '')}`,
        },
    }
}

const ReadingItem = async ({ params: { id }, searchParams: { range, accents } }: Props) => {
    // Библия переехала в собственный раздел, а её прежние адреса остались в карте
    // сайта и в чужих ссылках. Постоянный редирект, а не временный: адрес сменился
    // насовсем, и поисковикам надо об этом сказать прямо.
    const bible = await getBibleRedirect(id);
    if (bible) permanentRedirect(bible);

    setMeta();
    const itemPromise = getItem(id, range);

    return (
      <div className={myFont.variable}>
          <Suspense fallback={<div>Loading...</div>}>
              {/* @ts-expect-error Async Server Component */}
              <Content itemPromise={itemPromise} showAccents={accents === "1"} />
          </Suspense>
      </div>
    );
};

export default ReadingItem;

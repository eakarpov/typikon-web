import { redirect } from "next/navigation";
import { withSearch } from "@/lib/contentAliases";
import {getItem} from "@/app/weeks/[id]/api";
import Content from "@/app/weeks/[id]/Content";
import {Suspense} from "react";
import {csFontVariables, myFont} from "@/utils/font";
import {Metadata} from "next";
import {cookies} from "next/headers";
import {BIBLE_LANGUAGE_COOKIE, DEFAULT_BIBLE_LANGUAGE} from "@/utils/bibleLanguage";
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
    const lang = (await cookies()).get(BIBLE_LANGUAGE_COOKIE)?.value || DEFAULT_BIBLE_LANGUAGE;
    const item = await getItem(id, lang);

    return {
        title: item?.name,
        description: `Уставные чтения на день: ${item?.name}`,
        openGraph: {
            type: "website",
            url: `${SITE_URL}/penticostarion/${id}`,
            title: item?.name,
            description: `Уставные чтения на день: ${item?.name}`,
        },
    }
}

const PenticostarionItem = async ({ params: { id }, searchParams }: Props) => {

    const lang = (await cookies()).get(BIBLE_LANGUAGE_COOKIE)?.value || DEFAULT_BIBLE_LANGUAGE;
    const item = await getItem(id, lang);
    if (item?.redirectPath) redirect(withSearch(item.redirectPath, searchParams));
    const itemPromise = Promise.resolve(item);

    return (
      <div className={`${myFont.variable} ${csFontVariables}`}>
          <Suspense fallback={<div>Loading...</div>}>
              <Content itemPromise={itemPromise} />
          </Suspense>
      </div>
    );
};

export default PenticostarionItem;

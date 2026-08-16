import {getItem} from "@/app/weeks/[id]/api";
import Content from "@/app/weeks/[id]/Content";
import {Suspense} from "react";
import {csFont, myFont} from "@/utils/font";
import {Metadata} from "next";
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
    const item = await getItem(id, lang);

    return {
        title: item?.name,
        description: `Уставные чтения на день: ${item?.name}`,
        openGraph: {
            type: "website",
            url: `//www.typikon.su/penticostarion/${id}`,
            title: item?.name,
            description: `Уставные чтения на день: ${item?.name}`,
        },
    }
}

const PenticostarionItem = async ({ params: { id }}: { params: {id: string}}) => {

    const lang = (await cookies()).get(BIBLE_LANGUAGE_COOKIE)?.value || DEFAULT_BIBLE_LANGUAGE;
    const itemPromise = getItem(id, lang);

    return (
      <div className={`${myFont.variable} ${csFont.variable}`}>
          <Suspense fallback={<div>Loading...</div>}>
              {/* @ts-expect-error Async Server Component */}
              <Content itemPromise={itemPromise} />
          </Suspense>
      </div>
    );
};

export default PenticostarionItem;

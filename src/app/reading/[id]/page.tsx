import {getItem} from "@/app/reading/[id]/api";
import Content from "@/app/reading/[id]/Content";
import {Suspense} from "react";
import {myFont} from "@/utils/font";
import {setMeta} from "@/lib/meta";
import {Metadata} from "next";

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

const ReadingItem = ({ params: { id } }: { params: { id: string }}) => {
    setMeta();
    const itemPromise = getItem(id);

    return (
      <div className={myFont.variable}>
          <Suspense fallback={<div>Loading...</div>}>
              {/* @ts-expect-error Async Server Component */}
              <Content itemPromise={itemPromise} />
          </Suspense>
      </div>
    );
};

export default ReadingItem;

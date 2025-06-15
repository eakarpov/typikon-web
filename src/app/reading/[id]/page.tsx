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
        title: item?.name,
        description: item.description?.replace('́', '') || `Уставные чтения на день: ${item?.name?.replace('́', '')}`,
        openGraph: {
            type: "website",
            url: `//www.typikon.su/reading/${id}`,
            title: item?.name?.replace('́', ''),
            description: item.description?.replace('́', '') || `Уставные чтения на день: ${item?.name?.replace('́', '')}`,
        },
    }
}

const PenticostarionItem = ({ params: { id }}: { params: { id: string }}) => {
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

export default PenticostarionItem;

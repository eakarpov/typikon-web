import {getItem} from "@/app/penticostarion/[id]/api";
import Content from "@/app/penticostarion/[id]/Content";
import {Suspense} from "react";
import {myFont} from "@/utils/font";
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
    const item = await getItem(id);

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

const PenticostarionItem = ({ params: { id }}: { params: {id: string}}) => {

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

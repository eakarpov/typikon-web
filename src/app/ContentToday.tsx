import {Suspense} from "react";
import {ArrowLongRightIcon, ArrowLongLeftIcon} from "@heroicons/react/20/solid";
import {getItem} from "@/app/calendar/today/api";
import {TextType, valueTitle} from "@/utils/texts";
import Link from "next/link";

export interface IPartItemWithText {
    cite: string;
    text: {
        _id: string;
        name: string;
    };
    paschal: boolean;
    description: string;
}

export interface WithTextItems {
    items: IPartItemWithText[];
}

interface IError {
    error: string;
}

interface IContentMeta {
    itemsPromise: Promise<[any, IError?]>
}

const RenderItem = ({ data, type }: { data: null|WithTextItems, type: TextType}) => {
    if (!data) return null;

    return (
        <div className="font-serif flex flex-col">
            <span className="text-red-600">
                {valueTitle(type)}:
            </span>
            {data.items?.map((item) => (
                <span key={item.text._id}>
                    <Link href={`/reading/${item.text?._id}`}>
                        {item.text?.name}
                    </Link>
                </span>
            ))}
        </div>
    )
}

export const getMonth = (month: number) => {
    switch (month) {
        case 1:
            return "january";
        case 2:
            return "february";
        case 3:
            return "march";
        case 4:
            return "april";
        case 5:
            return "may";
        case 6:
            return "june";
        case 7:
            return "july";
        case 8:
            return "august";
        case 9:
            return "september";
        case 10:
            return "october";
        case 11:
            return "november";
        case 12:
            return "december";
        default:
            return "";
    }
};

const ContentTodayResult = async ({ itemsPromise }: IContentMeta) => {

    const [textsToday, error] = await itemsPromise;

    const d = new Date(+new Date() - 1000 * 60 * 60 * 24 * 13);
    const month = d.getMonth() + 1;

    const yesterday = new Date(+d - 1000 * 60 * 60 * 24);
    const today = new Date(+d + 1000 * 60 * 60 * 24);

    if (error) return null;

    return (
        <div
            className="flex flex-col border border-slate-300 rounded p-1"
        >
            <div
                className="flex flex-row font-serif border-b border-slate-300"
            >
                <div>
                    <Link href={`/calendar/${getMonth(yesterday.getMonth() + 1)}-${yesterday.getDate()}`}>
                        <span className="flex flex-row items-center">
                            <ArrowLongLeftIcon className="w-4 h-4" />&nbsp;<b>Вчера</b>
                        </span>
                    </Link>
                </div>
                <div className="flex flex-1">
                    <span className="flex flex-row flex-1 items-center justify-center">
                        <b>Сегодня, {d.getDate()}.{month >= 10 ? month : `0${month}`}</b>
                    </span>
                </div>
                <div>
                    <Link href={`/calendar/${getMonth(today.getMonth() + 1)}-${today.getDate()}`}>
                        <span className="flex flex-row items-center">
                            <b>Завтра</b>&nbsp;<ArrowLongRightIcon className="w-4 h-4" />
                        </span>
                    </Link>
                </div>
            </div>
            <div>
                <RenderItem data={textsToday.vigil} type={TextType.VIGIL} />
                <RenderItem data={textsToday.kathisma1} type={TextType.KATHISMA_1} />
                <RenderItem data={textsToday.kathisma2} type={TextType.KATHISMA_2} />
                <RenderItem data={textsToday.kathisma3} type={TextType.KATHISMA_3} />
                <RenderItem data={textsToday.ipakoi} type={TextType.IPAKOI} />
                <RenderItem data={textsToday.polyeleos} type={TextType.POLYELEOS} />
                <RenderItem data={textsToday.song3} type={TextType.SONG_3} />
                <RenderItem data={textsToday.song6} type={TextType.SONG_6} />
                <RenderItem data={textsToday.before1h} type={TextType.BEFORE_1h} />
            </div>
        </div>
    );
};

const ContentToday = () => {
  const itemsData = getItem();

  return (
      <Suspense fallback={<div>Loading...</div>}>
          {/* @ts-expect-error Async Server Component */}
          <ContentTodayResult itemsPromise={itemsData} />
      </Suspense>
  )
};

export default ContentToday;

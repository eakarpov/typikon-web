'use client';
import {Suspense, useEffect, useState} from "react";
import {ArrowLongRightIcon, ArrowLongLeftIcon} from "@heroicons/react/20/solid";
import {TextType, valueTitle} from "@/utils/texts";
import Link from "next/link";
import {getTodayDate, getZeroedNumber} from "@/utils/dates";
import {getMonth} from "@/lib/common/date";

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
    item: any;
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

const ContentTodayResult = ({ item: textsToday }: IContentMeta) => {

    const today = getTodayDate();
    const month = today.getMonth() + 1;

    const yesterday = new Date(+today - 1000 * 60 * 60 * 24);
    const tomorrow = new Date(+today + 1000 * 60 * 60 * 24);

    return (
        <div
            className="flex flex-col border border-slate-300 rounded p-1"
        >
            <div
                className="flex flex-row font-serif border-b border-slate-300"
            >
                <div>
                    <Link href={`/calendar/${getMonth(yesterday.getMonth() + 1)}-${getZeroedNumber(yesterday.getDate())}`}>
                        <span className="flex flex-row items-center">
                            <ArrowLongLeftIcon className="w-4 h-4" />&nbsp;<b>Вчера</b>
                        </span>
                    </Link>
                </div>
                <div className="flex flex-1">
                        <span className="flex flex-row flex-1 items-center justify-center">
                             <Link href={`/calendar/today`}>
                                <b>Сегодня, {getZeroedNumber(today.getDate())}.{getZeroedNumber(month)}</b>
                              </Link>
                        </span>
                </div>
                <div>
                    <Link href={`/calendar/${getMonth(tomorrow.getMonth() + 1)}-${getZeroedNumber(tomorrow.getDate())}`}>
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
  const [item, setItem] = useState<any|null>(null);

  useEffect(() => {
    fetch(`/api/v1/days/today?date=${new Date().toISOString()}`).then((res) => res.json()).then((res) => {
        setItem(res);
    })
  }, []);

  if (!item) return null;

  return (
      <Suspense fallback={<div>Loading...</div>}>
          <ContentTodayResult item={item} />
      </Suspense>
  )
};

export default ContentToday;

'use client';
import {Suspense, useEffect, useState} from "react";
import {ArrowLongRightIcon, ArrowLongLeftIcon} from "@heroicons/react/20/solid";
import {TextType, valueTitle} from "@/utils/texts";
import Link from "next/link";
import {formatDateISO, getZeroedNumber} from "@/utils/dates";

// Виджет работает с "церковной" датой (today, уже сдвинута на -13 дней относительно
// реальной, см. getTodayDate). Триодь и /calculator/[date] считаются от реальной
// (григорианской) даты, поэтому для ссылок и запроса к /api/calc сдвиг возвращается обратно.
const toRealDate = (churchDate: Date) => new Date(+churchDate + 1000 * 60 * 60 * 24 * 13);

export interface IPartItemWithText {
    cite: string;
    statia: number|null;
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
    today: Date;
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
                        {item.text?.name} {item.statia ? `[Статия ${item.statia}]` : ""}
                    </Link>
                </span>
            ))}
        </div>
    )
}

const ContentTodayResult = ({ item: textsToday, today }: IContentMeta) => {

    const month = today.getMonth() + 1;

    const realToday = toRealDate(today);
    const realYesterday = new Date(+realToday - 1000 * 60 * 60 * 24);
    const realTomorrow = new Date(+realToday + 1000 * 60 * 60 * 24);

    return (
        <div
            className="flex flex-col border border-slate-300 rounded p-1"
        >
            <div
                className="flex flex-row font-serif border-b border-slate-300"
            >
                <div>
                    <Link href={`/calculator/${formatDateISO(realYesterday)}`}>
                        <span className="flex flex-row items-center">
                            <ArrowLongLeftIcon className="w-4 h-4" />&nbsp;<b>Вчера</b>
                        </span>
                    </Link>
                </div>
                <div className="flex flex-1">
                        <span className="flex flex-row flex-1 items-center justify-center">
                             <Link href={`/calculator/${formatDateISO(realToday)}`}>
                                <b>Сегодня, {getZeroedNumber(today.getDate())}.{getZeroedNumber(month)}</b>
                              </Link>
                        </span>
                </div>
                <div>
                    <Link href={`/calculator/${formatDateISO(realTomorrow)}`}>
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
                <RenderItem data={textsToday.h3} type={TextType.H3} />
                <RenderItem data={textsToday.h6} type={TextType.H6} />
                <RenderItem data={textsToday.h9} type={TextType.H9} />
            </div>
        </div>
    );
};

const ContentToday = ({ today }: { today: Date; }) => {
  const [item, setItem] = useState<any|null>(null);

  useEffect(() => {
      const value = formatDateISO(toRealDate(today));
    fetch(`/api/calc`, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            date: value,
        }),
    }).then((res) => res.json()).then((res) => {
        setItem(res.day);
    })
  }, [today]);

  if (!item) return null;

  return (
      <Suspense fallback={<div>Loading...</div>}>
          <ContentTodayResult item={item} today={today} />
      </Suspense>
  )
};

export default ContentToday;

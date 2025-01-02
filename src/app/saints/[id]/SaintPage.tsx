'use client';
import React, {useCallback, useMemo, useState} from "react";
import {DneslovKind} from "@/utils/texts";
import Link from "next/link";
import {ArrowTopRightOnSquareIcon} from "@heroicons/react/24/outline";

const getHostName = (url: string) => {
  const match = /:\/\/([^/]+)\//.exec(url);
  return match && match[1];
};

enum COLLECTION_TYPE {
    BOOK,
    MENTION,
    AUTHOR,
}

const SaintPage = ({ item, items, mentions }: {item: any, items: any[], mentions: any[] }) => {
    const authorItems = useMemo(() => items.filter(el => el.dneslovType === DneslovKind.AUTHOR), [items]);
    const bookItems = useMemo(() => items.filter(el => el.dneslovType !== DneslovKind.AUTHOR), [items]); // MEMORY

    const [collectionType, setCollectionType] = useState(COLLECTION_TYPE.BOOK);

    const collection = useMemo(() => {
        switch (collectionType) {
            case COLLECTION_TYPE.BOOK:
                return bookItems;
            case COLLECTION_TYPE.AUTHOR:
                return authorItems;
            case COLLECTION_TYPE.MENTION:
                return mentions;
            default:
                return [];
        }
    }, [collectionType, bookItems, authorItems, mentions]);

    const onPick = useCallback((picked: COLLECTION_TYPE) => () => {
        setCollectionType(picked);
    }, []);

    const lastMemo = Array.isArray(item?.memoes) && item.memoes[0];

    return (
        <>
            <div className="flex flex-col mb-2">
                {item?.slug && (
                    <span className="font-serif pr-4 text-amber-800 cursor-pointer flex flex-row items-center">
                            <Link target="_blank" href={`https://dneslov.org/${item.slug}?c=днес,рпц`}>
                                Днеслов&nbsp;
                            </Link>
                            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                        </span>
                )}
                <p className="font-serif">
                    Страница памяти: <strong>{lastMemo?.title}</strong>
                </p>
                {lastMemo && (
                    <div className="font-serif">
                        <p className="max-h-80 overflow-auto">
                            {lastMemo?.description}
                        </p>
                    </div>
                )}
                <p className="font-serif font-bold">
                    Ссылки
                </p>
                <div className="flex flex-row flex-wrap gap-4">
                    {item?.links?.map((link: any) => (
                        <div
                          key={link.id}
                          className="font-serif text-blue-600 border rounded border-slate-300 p-1 text-sm"
                          style={{ width: "fit-content"}}
                        >
                            <Link href={link.url}>
                                {getHostName(link.url)}
                            </Link>
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex flex-row border rounded border-slate-300 p-1" style={{ width: "fit-content"}}>
                <div
                    className="pr-2 cursor-pointer font-serif border-r mr-1"
                    onClick={onPick(COLLECTION_TYPE.BOOK)}
                    style={{ fontWeight: collectionType === COLLECTION_TYPE.BOOK ? 'bold' : 'normal' }}
                >
                    Тексты памяти
                </div>
                <div
                    className="pr-2 cursor-pointer font-serif border-r mr-1"
                    onClick={onPick(COLLECTION_TYPE.MENTION)}
                    style={{ fontWeight: collectionType === COLLECTION_TYPE.MENTION ? 'bold' : 'normal' }}
                >
                    Тексты с упоминанием памяти
                </div>
                <div
                    className="pr-2 cursor-pointer font-serif"
                    onClick={onPick(COLLECTION_TYPE.AUTHOR)}
                    style={{ fontWeight: collectionType === COLLECTION_TYPE.AUTHOR ? 'bold' : 'normal' }}
                >
                    Тексты авторства святого
                </div>
            </div>
            <div className="mt-4">
                {collection.map((item) => (
                    <div className="font-serif" key={item.id}>
                        <Link href={`/reading/${item.id}`}>
                            {item.name}
                        </Link>
                    </div>
                ))}
            </div>
        </>
    );
}

export default SaintPage;

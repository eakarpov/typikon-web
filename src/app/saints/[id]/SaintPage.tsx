'use client';
import React, {useCallback, useMemo, useState} from "react";
import {DneslovKind} from "@/utils/texts";
import Link from "next/link";
import Markdown from "react-markdown";
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

const SaintPage = ({ id, item, items, mentions, linkedNoble, akathists = [] }: {id: string, item: any, items: any[], mentions: any[], linkedNoble?: {id: number; name: string} | null, akathists?: {id: string; title: string; stanzas: number}[] }) => {
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
    // Имя приходит со святцев, а тексты — наши. Когда dneslov.org недоступен,
    // страница остаётся на месте: подписываем память номером и идём дальше.
    const heading = lastMemo?.title || item?.title || item?.short_name || `Память №${id}`;

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
                    Страница памяти: <strong>{heading}</strong>
                </p>
                {!item && (
                    <p className="font-serif text-sm text-slate-500">
                        Сведения о святом со святцев dneslov.org сейчас недоступны — показаны только наши тексты.
                    </p>
                )}
                {linkedNoble && (
                    <p className="font-serif">
                        В родословной: <Link className="text-blue-600 hover:underline" href={`/nobles/${linkedNoble.id}`}>{linkedNoble.name}</Link>
                    </p>
                )}
                {!!akathists.length && (
                    // Связь ставится не автоматом: сопоставитель предлагает,
                    // человек подтверждает в админке (/admin/akathists). Ошибка
                    // в проставленной связи тише отсутствующей — она выглядит
                    // как факт, и на этой странице её никто не заподозрит.
                    <p className="font-serif">
                        {akathists.length > 1 ? "Акафисты: " : "Акафист: "}
                        {akathists.map((a, i) => (
                            <React.Fragment key={a.id}>
                                {i > 0 && ", "}
                                <Link className="text-amber-800 hover:underline" href={`/akathists/${a.id}`}>
                                    {a.title}
                                </Link>
                            </React.Fragment>
                        ))}
                    </p>
                )}
                {lastMemo && (
                    <div className="font-serif">
                        <div className="max-h-80 overflow-auto">
                            <Markdown>
                                {lastMemo?.description}
                            </Markdown>
                        </div>
                    </div>
                )}
                {!!item?.links?.length && (
                    <p className="font-serif font-bold">
                        Ссылки
                    </p>
                )}
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
            {/* Вкладки — кнопки, а не div с onClick: иначе переключить подборку нельзя ни
                с клавиатуры, ни скринридером, а раздел как раз про доступность чтений. */}
            <div
                role="tablist"
                aria-label="Подборки текстов святого"
                className="flex flex-row border rounded border-slate-300 p-1"
                style={{ width: "fit-content"}}
            >
                <button
                    type="button"
                    role="tab"
                    aria-selected={collectionType === COLLECTION_TYPE.BOOK}
                    className="pr-2 cursor-pointer font-serif border-r mr-1"
                    onClick={onPick(COLLECTION_TYPE.BOOK)}
                    style={{ fontWeight: collectionType === COLLECTION_TYPE.BOOK ? 'bold' : 'normal' }}
                >
                    Тексты памяти
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={collectionType === COLLECTION_TYPE.MENTION}
                    className="pr-2 cursor-pointer font-serif border-r mr-1"
                    onClick={onPick(COLLECTION_TYPE.MENTION)}
                    style={{ fontWeight: collectionType === COLLECTION_TYPE.MENTION ? 'bold' : 'normal' }}
                >
                    Тексты с упоминанием памяти
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={collectionType === COLLECTION_TYPE.AUTHOR}
                    className="pr-2 cursor-pointer font-serif"
                    onClick={onPick(COLLECTION_TYPE.AUTHOR)}
                    style={{ fontWeight: collectionType === COLLECTION_TYPE.AUTHOR ? 'bold' : 'normal' }}
                >
                    Тексты авторства святого
                </button>
            </div>
            <div className="mt-4">
                {!collection.length && (
                    <p className="font-serif text-slate-500">
                        В этой подборке пока пусто.
                    </p>
                )}
                {collection.map((text) => (
                    <div className="font-serif mb-2" key={text.id}>
                        <Link href={`/reading/${text.alias || text.id}`}>
                            {text.name}
                        </Link>
                        {/* Ради этой строки и затевалось ревью упоминаний: видно не только
                            где помянут святой, но и какими словами. */}
                        {collectionType === COLLECTION_TYPE.MENTION && text.mention?.context && (
                            <p className="text-sm text-slate-600 italic">
                                …{text.mention.context}…
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </>
    );
}

export default SaintPage;

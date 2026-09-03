'use client';
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {DneslovKind} from "@/utils/texts";
import Link from "next/link";
import Markdown from "react-markdown";
import {ArrowTopRightOnSquareIcon} from "@heroicons/react/24/outline";
import {SIGN_LABELS} from "@/utils/chantLabels";
import type {MemoryDay} from "@/lib/saintFacts";
import type {SaintMemoryRow} from "@/lib/memories";
import type {SaintDedication} from "@/lib/temples";

// ДОСЬЕ СВЯТОГО. Пять разделов знали об одном лице и не показывали этого вместе:
// каталог святцев (чин, годы, дни памяти, иконы), реестр памятей (какие службы
// ему назначены и с каким знаком), корпус текстов (служба, упоминания, авторство),
// корпус песнопений (акафисты), каталог храмов (кому посвящены престолы) и
// родословная. Здесь они сходятся на одну страницу; НИ ОДНОЙ НОВОЙ СТРОКИ ДАННЫХ
// под этим нет — только связи, которые уже были проставлены.
//
// Пустой раздел не рисуется вовсе. Это же и аудит связности: где страница
// оказалась короткой, там связь на самом деле не проставлена, и искать надо в
// очереди разбора (/admin/mentions), а не в житии.

const getHostName = (url: string) => {
  const match = /:\/\/([^/]+)\//.exec(url);
  return match && match[1];
};

/**
 * Изображение с чужого CDN. Не загрузилось — исчезает, а не оставляет битую рамку:
 * файлы лежат у святцев, их сервер бывает недоступен, и вся страница построена на
 * том, что чужая недоступность нам не авария (см. getMemory в api.ts).
 */
const CdnImage = ({ src, alt, size, rounded, onFail }: {
    src: string; alt: string; size: number; rounded?: boolean; onFail?: () => void;
}) => {
    const [failed, setFailed] = useState(false);
    const ref = useRef<HTMLImageElement>(null);

    const fail = useCallback(() => {
        setFailed(true);
        onFail?.();
    }, [onFail]);

    // Одного onError мало: разметка приходит с сервера, и картинка успевает
    // упасть ДО того, как React прицепит обработчик, — событие проходит мимо.
    // Поэтому при появлении ещё и спрашиваем сам элемент, вышло ли у него что-нибудь.
    useEffect(() => {
        const img = ref.current;
        if (img?.complete && !img.naturalWidth) fail();
    }, [fail]);

    if (failed) return null;
    return (
        <img
            ref={ref}
            src={src}
            alt={alt}
            width={size}
            height={size}
            onError={fail}
            className={`border border-slate-200${rounded ? " rounded-full" : ""}`}
            style={{ width: `${size}px`, height: `${size}px`, objectFit: "cover" }}
        />
    );
};

/**
 * Полоска икон с указанием, откуда они. Упали все — уходит и подпись: строка
 * «изображения со святцев» без единого изображения обещает то, чего на странице нет.
 */
const IconStrip = ({ images }: { images: { url: string; thumbUrl: string | null; title: string | null }[] }) => {
    const [failed, setFailed] = useState(0);
    const onFail = useCallback(() => setFailed((n) => n + 1), []);

    return (
        <div className="mt-3">
            <div className="flex flex-row flex-wrap gap-2">
                {images.map((image) => (
                    <Link key={image.url} href={image.url} target="_blank">
                        <CdnImage src={image.thumbUrl!} alt={image.title ?? ""} size={84} onFail={onFail} />
                    </Link>
                ))}
            </div>
            {failed < images.length && (
                <p className="font-serif text-xs text-slate-500 mt-1">
                    Изображения — со святцев dneslov.org.
                </p>
            )}
        </div>
    );
};

/** Подписи полей карточки. Один вид у всех строк — иначе досье читается как свалка. */
const Row = ({ name, children }: { name: string; children: React.ReactNode }) => (
    <div className="font-serif flex flex-row flex-wrap gap-x-2 py-1 border-b border-slate-100">
        <span className="text-slate-500 min-w-[9rem]">{name}</span>
        <span className="flex-1">{children}</span>
    </div>
);

export interface SaintCard {
    name: string | null;
    altNames: string[];
    /** «собор святых», «святыня» — у обычного лица подписи нет. */
    kind: string | null;
    orders: string[];
    baseYear: string | null;
    days: MemoryDay[];
    roundelUrl: string | null;
    images: { url: string; thumbUrl: string | null; title: string | null }[];
}

enum COLLECTION_TYPE {
    BOOK,
    MENTION,
    AUTHOR,
}

const SaintPage = ({ id, card, item, items, mentions, linkedNoble, akathists = [], memories = [], dedications = [] }: {
    id: string,
    card?: SaintCard,
    item: any,
    items: any[],
    mentions: any[],
    linkedNoble?: {id: number; name: string} | null,
    akathists?: {id: string; title: string; stanzas: number}[],
    memories?: SaintMemoryRow[],
    dedications?: SaintDedication[],
}) => {
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
    // Подписываем СВОИМ именем: как памятью называют по-русски — наше решение, а не
    // их подпись («Мари́я Богоро́дица» вместо «Богородица»). Всё, что ниже, — запасные
    // пути на случай памяти, которой ещё нет в каталоге.
    const heading = card?.name || lastMemo?.title || item?.title || item?.short_name || `Память №${id}`;
    const altNames = card?.altNames ?? [];
    // Чин, вид записи и опорный год — одной строкой под именем: порознь это три
    // подписи по два слова, и каждая заняла бы строку ради ничего.
    const subtitle = [...(card?.orders ?? []), card?.kind].filter(Boolean).join(", ");

    return (
        <>
            <div className="flex flex-col mb-3">
                <div className="flex flex-row gap-3 items-start">
                    {card?.roundelUrl && (
                        // Файл не наш и лежит на их CDN — как и в списках содержания
                        // книг (DneslovRoundImage). Своего собрания изображений у нас
                        // нет, и притворяться, что есть, незачем.
                        <CdnImage src={card.roundelUrl} alt="" size={64} rounded />
                    )}
                    <div className="flex flex-col">
                        <p className="font-serif">
                            Страница памяти: <strong>{heading}</strong>
                        </p>
                        {!!subtitle && (
                            <p className="font-serif text-sm text-slate-600">{subtitle}</p>
                        )}
                        {!!altNames.length && (
                            <p className="font-serif text-sm text-slate-500">
                                Известна также как: {altNames.join(", ")}
                            </p>
                        )}
                        {item?.slug && (
                            <span className="font-serif text-amber-800 cursor-pointer flex flex-row items-center text-sm">
                                <Link target="_blank" href={`https://dneslov.org/${item.slug}?c=днес,рпц`}>
                                    Днеслов&nbsp;
                                </Link>
                                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                            </span>
                        )}
                    </div>
                </div>

                {!item && (
                    <p className="font-serif text-sm text-slate-500 mt-1">
                        Сведения о святом со святцев dneslov.org сейчас недоступны — показаны только наши тексты.
                    </p>
                )}

                <div className="mt-2">
                    {/* ОПОРНЫЙ ГОД, А НЕ ГОД КОНЧИНЫ: у святцев это год того события, по
                        которому память поставлена в ряд (преставление, перенесение мощей,
                        написание образа). Крестик утверждал бы то, чего в поле не сказано. */}
                    {card?.baseYear && (
                        <Row name="Опорный год">{card.baseYear}</Row>
                    )}

                    {/* ДНИ ПАМЯТИ. Число месяцеслова — юлианское; рядом гражданский день
                        ближайшего наступления, и он же ссылка на чтения этого дня. Перевод
                        идёт через юлианский день, а не «плюс тринадцать»: разница стилей от
                        века к веку растёт. */}
                    {!!card?.days.length && (
                        <Row name="Дни памяти">
                            <span className="flex flex-col gap-0.5">
                                {card.days.map((day) => (
                                    <span key={day.raw}>
                                        {day.julian && <>{day.julian} <span className="text-slate-500 text-sm">(ст. ст.)</span></>}
                                        {day.julian && day.civil && " — "}
                                        {day.civil && (day.iso
                                            ? <Link className="text-amber-800 hover:underline" href={`/calculator/${day.iso}`}>{day.civil}</Link>
                                            : day.civil)}
                                        {day.note && <span className="text-slate-500 text-sm"> · {day.note}</span>}
                                    </span>
                                ))}
                            </span>
                        </Row>
                    )}

                    {/* ПАМЯТИ В КНИГАХ. Только выверенные человеком связи: догадка
                        сопоставителя здесь выглядела бы как назначенная лицу служба. */}
                    {!!memories.length && (
                        <Row name="Памяти в книгах">
                            <span className="flex flex-col gap-0.5">
                                {memories.map((memory) => (
                                    <span key={memory.memoryId}>
                                        <Link className="text-amber-800 hover:underline" href={`/memories/${memory.memoryId}`}>
                                            {memory.label}
                                        </Link>
                                        <span className="text-sm text-slate-500">
                                            {" — "}{memory.address}
                                            {memory.sign && `, ${SIGN_LABELS[memory.sign] ?? memory.sign}`}
                                        </span>
                                    </span>
                                ))}
                            </span>
                        </Row>
                    )}

                    {!!akathists.length && (
                        // Связь ставится не автоматом: сопоставитель предлагает,
                        // человек подтверждает в админке (/admin/akathists). Ошибка
                        // в проставленной связи тише отсутствующей — она выглядит
                        // как факт, и на этой странице её никто не заподозрит.
                        <Row name={akathists.length > 1 ? "Акафисты" : "Акафист"}>
                            {akathists.map((a, i) => (
                                <React.Fragment key={a.id}>
                                    {i > 0 && ", "}
                                    <Link className="text-amber-800 hover:underline" href={`/akathists/${a.id}`}>
                                        {a.title}
                                    </Link>
                                </React.Fragment>
                            ))}
                        </Row>
                    )}

                    {/* ХРАМЫ. Число считается тем же условием, каким отбирает указатель:
                        иначе карточка и /temples?dedication= говорили бы разное. */}
                    {!!dedications.length && (
                        <Row name="Храмы с посвящением">
                            <span className="flex flex-col gap-0.5">
                                {dedications.map((dedication) => (
                                    <span key={dedication.slug}>
                                        <Link className="text-amber-800 hover:underline" href={`/dedications/${dedication.slug}`}>
                                            {dedication.short}
                                        </Link>
                                        <span className="text-sm text-slate-500">
                                            {" — "}{dedication.count.toLocaleString("ru-RU")}
                                            {" · "}
                                        </span>
                                        <Link className="text-sm text-amber-800 hover:underline" href={`/temples/map?dedication=${dedication.slug}`}>
                                            на карте
                                        </Link>
                                    </span>
                                ))}
                            </span>
                        </Row>
                    )}

                    {linkedNoble && (
                        <Row name="В родословной">
                            <Link className="text-blue-600 hover:underline" href={`/nobles/${linkedNoble.id}`}>{linkedNoble.name}</Link>
                        </Row>
                    )}
                </div>

                {/* Иконы — с их CDN, горстью: каждая миниатюра стоит читателю запроса
                    к чужому серверу, а собрания изображений у нас своего нет. */}
                {!!card?.images.length && <IconStrip images={card.images} />}

                {lastMemo && (
                    <div className="font-serif mt-3">
                        <div className="max-h-80 overflow-auto">
                            <Markdown>
                                {lastMemo?.description}
                            </Markdown>
                        </div>
                    </div>
                )}
                {!!item?.links?.length && (
                    <p className="font-serif font-bold mt-2">
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

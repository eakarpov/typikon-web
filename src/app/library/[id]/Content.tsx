import Link from "next/link";
import CountMeta from "@/app/meta/CountMeta";
import DneslovRoundImage from "@/lib/common/DneslovRoundImage";
import { saintRoundels } from "@/lib/saints";
import {UserCircleIcon} from "@heroicons/react/24/outline";
import {TextReadiness} from "@/utils/texts";
import {bookCategoryLabel, bookPresentation, libraryBookHref} from "@/utils/libraryBooks";
import {getItems} from "@/app/library/api";

const Content = async ({ itemPromise }: { itemPromise: Promise<any> }) => {

    const [item, err] = await itemPromise;

    // Кругляши на всю книгу одним запросом к своей базе. Раньше их тянул из браузера
    // читателя каждый ряд списка по отдельности — полсотни запросов к чужому серверу
    // на одну страницу содержания.
    const roundels = await saintRoundels(
        (item?.texts ?? []).map((t: any) => t?.dneslovId).filter(Boolean),
    );

    if (err) {
        return (
            <div>
                Ошибка поиска
            </div>
        );
    }
    if (!item) {
        return (
          <div>
              Ничего не нашлось
          </div>
        );
    }

    const info = bookPresentation(item.language);
    const [books] = item.workKey ? await getItems() : [null];
    const editions = (books || []).filter((book: any) => book.workKey === item.workKey && book._id.toString() !== item.id);

    return (
        <div className="flex flex-col pt-2">
            <CountMeta />
            <h1 className="font-bold font-serif">{item.name}</h1>
            {item.author && (
                <p className="font-serif">
                    <strong>Автор: </strong>{item.author}
                </p>
            )}
            {item.translator && (
                <p className="font-serif">
                    <strong>Переводчик: </strong>{item.translator}
                </p>
            )}
            <p className="font-serif"><strong>Язык: </strong>{info.label}</p>
            <p className="font-serif"><strong>Начертание: </strong>{info.scriptLabel}</p>
            <p className="font-serif"><strong>Тематика: </strong>{bookCategoryLabel(item.category)}</p>
            {item.editionTitle && <p className="font-serif"><strong>Редакция: </strong>{item.editionTitle}</p>}
            {editions.length > 0 && (
                <nav aria-label="Другие редакции" className="font-serif my-2">
                    <p className="font-bold">Другие редакции:</p>
                    <ul>
                        {editions.map((book: any) => (
                            <li key={book._id.toString()}>
                                <Link className="text-red-900 hover:underline" href={libraryBookHref({ ...book, id: book._id.toString() })}>
                                    {book.name} · {bookPresentation(book.language).label}, {bookPresentation(book.language).scriptLabel}
                                    {book.editionTitle ? ` · ${book.editionTitle}` : ""}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>
            )}
            <h2 className="font-serif">Содержание:</h2>
            <div className="pt-2">
                {item.texts.map((text: any) => (
                    <div className="flex flex-row items-center" key={text._id.toString()}>
                        <div style={{ width: "42px", height: "42px", display: 'flex', alignItems: 'center' }}>
                            <DneslovRoundImage
                                textType={text.type}
                                id={text.dneslovId}
                                roundelUrl={roundels[String(text.dneslovId)] ?? null}
                            />
                        </div>
                        <Link
                            href={`/reading/${text.alias || text._id.toString()}`}
                            className={`
                              cursor-pointer font-serif 
                              ${text.readiness === TextReadiness.CORRECTION && ` text-yellow-600 `}
                              ${text.readiness === TextReadiness.TEXTING && ` text-stone-400 `}
                              ${text.readiness === TextReadiness.PRESENCE && ` text-red-600 `}
                              ${text.readiness === TextReadiness.ABSENCE && ` text-red-900 `}
                            `}
                        >
                            {text.name || text._id.toString()}
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Content;

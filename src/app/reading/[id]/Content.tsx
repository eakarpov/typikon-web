import { ReadinessButton } from "@/app/components/DayPart";
import {isFootnoteBook} from "@/utils/texts";
import {ArrowTopRightOnSquareIcon, BookOpenIcon, UserCircleIcon} from "@heroicons/react/24/outline";
import TextImages from "@/app/reading/TextImages";
import DneslovImages from "@/app/reading/DneslovImages";
import reactStringReplace from "react-string-replace";
import FootnoteLinkNew from "@/app/components/FootnoteLinkNew";
import Link from "next/link";
import {redirect} from "next/navigation";
import TextToDate from "@/app/reading/[id]/TextToDate";
import TextSave from "@/app/components/save/TextSave";
import ReadingContent from "@/app/reading/[id]/ReadingContent";

const Content = async ({ itemPromise }: { itemPromise: Promise<any> }) => {

    const [item, err, shouldRedirect] = await itemPromise;

    if (!item) {
        return (
          <div>
              Ничего не нашлось
          </div>
        );
    }

    if (shouldRedirect) {
        redirect(`/reading/${item.alias}`);
    }

    return (
        <div className="flex flex-col md:flex-row">
        <div className="flex flex-col pt-2 flex-1">
            <div className="text-1xl font-bold font-serif">
                <div className="flex flex-row items-center overflow-scroll">
                    {item.ruLink && (
                        <span className="pr-4 text-amber-800 cursor-pointer flex flex-row items-center">
                            <a href={item.ruLink} target="_blank" rel="noreferrer">
                                Русский текст&nbsp;
                            </a>
                            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                        </span>
                    )}
                    {item.link && (
                        <span className="pr-4 text-amber-800 cursor-pointer flex flex-row items-center">
                            <a href={item.link} target="_blank" rel="noreferrer">
                                Скан текста&nbsp;
                            </a>
                            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                        </span>
                    )}
                    {item.bookId && (
                        <span className="pr-4 text-amber-800 cursor-pointer flex flex-row items-center">
                            <Link href={`/library/${item.bookId}`}>
                                Книга&nbsp;
                            </Link>
                            <BookOpenIcon className="w-4 h-4" />
                        </span>
                    )}
                    <TextToDate id={item.id} />
                    {item.dneslovId && (
                        <span className="pr-4 text-amber-800 cursor-pointer flex flex-row items-center">
                            <Link href={`/saints/${item.dneslovId}`}>
                                Страница святого&nbsp;
                            </Link>
                            <UserCircleIcon className="w-4 h-4" />
                        </span>
                    )}
                    <TextSave text={item} canDownloadPdf={process.env.CAN_DOWNLOAD_PDF} />
                </div>
                <div className="flex flex-row items-center">
                    <span className="w-fit text-xs pr-2">
                        <ReadinessButton value={item.readiness} />
                    </span>
                    <span className="font-normal">
                        Дата последнего обновления: {item.updatedAt
                        ? new Date(item.updatedAt).toLocaleDateString("ru-RU")
                        : "Не задано"}
                    </span>
                </div>
                <div className="flex flex-row items-center">
                    <span className="pr-2 font-serif">
                        {item.name}
                    </span>
                </div>
            </div>
            {item.poems && (
                <div className="space-y-1 mt-2">
                    <p className="font-serif">
                        <b>Стихи́:</b>
                    </p>
                    {item.poems?.split("\n").map((verse: string) => (
                        <p
                            key={verse}
                            className="whitespace-pre-wrap font-serif first-letter:text-red-600"
                        >
                            <i>
                                {verse}
                            </i>
                        </p>
                    ))}
                </div>
            )}
            <ReadingContent item={item} />
            {item.footnotes?.length > 0 && (
                <div className="font-serif">
                    <p>
                        <strong>Сноски:</strong>
                    </p>
                    {item.footnotes?.map((footnote: string, index: number) => {
                        const { isBook } = isFootnoteBook(footnote);
                        return isBook ? null : (
                            <p key={footnote} id={`footnotes-${index + 1}`}>
                                {index + 1} {footnote}
                            </p>
                        );
                    })}
                </div>
            )}
        </div>
        {!!item.images?.length && (
            <TextImages images={item.images} />
        )}
        {item.dneslovId && (
            <DneslovImages dneslovId={item.dneslovId} />
        )}
        </div>
    );
};

export default Content;

import { ReadinessButton } from "@/app/components/DayPart";
import TextPart from "@/app/components/TextPart";
import {fullTitle, isFootnoteBook} from "@/utils/texts";
import {ArrowTopRightOnSquareIcon} from "@heroicons/react/24/outline";

const Content = async ({ itemPromise }: { itemPromise: Promise<any> }) => {

    const [item] = await itemPromise;

    if (!item) {
        return (
          <div>
              Ничего не нашлось
          </div>
        );
    }

    return (
        <div className="flex flex-col pt-2">
            <p className="text-1xl font-bold">
                <div className="flex flex-row items-center">
                    {item.ruLink && (
                        <span className="pr-2 text-amber-800 cursor-pointer flex flex-row items-center">
                            <a href={item.ruLink} target="_blank" rel="noreferrer">
                                Русский текст&nbsp;
                            </a>
                            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                        </span>
                    )}
                    {item.link && (
                        <span className="pr-2 text-amber-800 cursor-pointer flex flex-row items-center">
                            <a href={item.link} target="_blank" rel="noreferrer">
                                Скан текста&nbsp;
                            </a>
                            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                        </span>
                    )}
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
            </p>
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
            <div className="space-y-1 mt-2">
                {item.content?.split("\n\n").map((paragraph: string) => (
                    <p
                        key={paragraph}
                        className="whitespace-pre-wrap text-justify text-lg font-serif first-letter:text-red-600"
                    >
                        {paragraph.split(/{k\|/).map((value: any, index: number) => {
                            if (!index) return (
                                // @ts-ignore
                                <TextPart
                                    key={value}
                                    footnotes={item.footnotes}
                                    value={value}
                                />
                            );
                            return value.split(/}/)
                                .map((splitItem: string, i: number) =>
                                    !i ? (
                                        <span key={splitItem} className="text-red-600">
                                                         {/*@ts-ignore*/}
                                            <TextPart
                                                footnotes={item.footnotes}
                                                value={splitItem}
                                            />
                                                    </span>
                                    ) : (
                                        // @ts-ignore
                                        <TextPart
                                            key={splitItem}
                                            footnotes={item.footnotes}
                                            value={splitItem}
                                        />
                                    ));
                        })}
                    </p>
                ))}
            </div>
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
    );
};

export default Content;

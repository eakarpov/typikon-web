import {
    fullTitle,
    isFootnoteBook,
    printTextReadiness,
    TextReadiness,
    TextType, valueTitle
} from "@/utils/texts";
import TextPart from "@/app/components/TextPart";
import {ArrowTopRightOnSquareIcon} from "@heroicons/react/24/outline";

export interface IReadDayPart {
    value: any;
    valueName: TextType;
    triodic?: boolean;
}

const ReadinessButton = ({ value }: { value: TextReadiness }) => {
    switch (value) {
        case TextReadiness.READY:
            return (
                <span className="bg-green-600 text-white p-1 rounded-sm">
                    {printTextReadiness(value)}
                </span>
            );
        case TextReadiness.CORRECTION:
            return (
                <span className="bg-blue-600 text-white p-1 rounded-sm">
                    {printTextReadiness(value)}
                </span>
            );
        case TextReadiness.TEXTING:
            return (
                <span className="bg-yellow-600 text-white p-1 rounded-sm">
                    {printTextReadiness(value)}
                </span>
            );
        case TextReadiness.PRESENCE:
            return (
                <span className="bg-grey-600 text-white p-1 rounded-sm">
                    {printTextReadiness(value)}
                </span>
            );
        case TextReadiness.ABSENCE:
            return (
                <span className="bg-red-600 text-white p-1 rounded-sm">
                    {printTextReadiness(value)}
                </span>
            );
        default:
            return (
                <span className="bg-red-600 text-white p-1 rounded-sm">
                    {printTextReadiness(value)}
                </span>
            );
    }
};

const DayPart = ({
    value,
    valueName,
    triodic,
}: IReadDayPart) => {
    return value && (
            <section className="space-y-2" id={valueName}>
                <p className="text-1xl font-bold">
                    {valueTitle(valueName)}
                </p>
                {value.items?.map((item: any) => item.text ? (
                    <div key={item.text._id.toString()}>
                        <p className="text-1xl font-bold">
                            <span className="flex flex-row items-center">
                                {item.text.ruLink && (
                                    <span className="pr-2 text-amber-800 cursor-pointer flex flex-row items-center">
                                        <a href={item.text.ruLink} target="_blank" rel="noreferrer">
                                            Русский текст&nbsp;
                                        </a>
                                        <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                                    </span>
                                )}
                                <span className="w-fit text-xs pr-2">
                                    <ReadinessButton value={item.text.readiness} />
                                </span>
                                <span className="font-normal">
                                    Дата последнего обновления: {item.text.updatedAt
                                        ? new Date(item.text.updatedAt).toLocaleDateString("ru-RU")
                                        : "Не задано"}
                                </span>
                            </span>
                            {fullTitle(item.text.type, item.text.book?.author, item.text.start)}
                        </p>
                        {item.cite && (
                            <p>
                                <strong>Типикон говорит:</strong> {item.cite}
                            </p>
                        )}
                        {item.text.description && (
                            <p>
                                {item.text.description}
                            </p>
                        )}
                        <div className="space-y-1 mt-2">
                            {item.text.content?.split("\n\n").map((paragraph: string, j: number) => (
                                <p
                                    key={paragraph}
                                    className="whitespace-pre-wrap text-justify text-lg font-serif first-letter:text-red-600"
                                >
                                    {paragraph.split(/{k\|/).map((value: any, index: number) => {
                                        if (!index) return (
                                            // @ts-ignore
                                            <TextPart
                                                key={value}
                                                footnotes={item.text.footnotes}
                                                value={value}
                                            />
                                        );
                                        return value.split(/}/)
                                            .map((splitItem: string, i: number) =>
                                                !i ? (
                                                    <span key={splitItem} className="text-red-600">
                                                         {/*@ts-ignore*/}
                                                        <TextPart
                                                            footnotes={item.text.footnotes}
                                                            value={splitItem}
                                                        />
                                                    </span>
                                                ) : (
                                                    // @ts-ignore
                                                    <TextPart
                                                        key={splitItem}
                                                        footnotes={item.text.footnotes}
                                                        value={splitItem}
                                                    />
                                                ));
                                    })}
                                </p>
                            ))}
                        </div>
                        {item.text.footnotes?.length > 0 && (
                            <div className="font-serif">
                                <p>
                                    <strong>Сноски:</strong>
                                </p>
                                {item.text.footnotes?.map((footnote: string, index: number) => {
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
                ) : triodic && !item.triodic && (
                    <div>
                        <strong>{valueTitle(valueName)} календарное чтение (Пролог, похвальное слово святому)</strong> - смотри соответствующий день в календарных чтениях
                    </div>
                ))}
            </section>
    );
};

export default DayPart;

import {fullTitle, isFootnoteBook, TextType} from "@/utils/texts";
import TextPart from "@/app/components/TextPart";

export interface IReadDayPart {
    value: any;
    valueName: TextType;
}

const DayPart = ({
    value,
    valueName,
}: IReadDayPart) => {
    return value && (
            <section className="space-y-2" id={valueName}>
                {value.items?.map((item: any) => item.text && (
                    <div key={item.text._id.toString()}>
                        <p className="text-1xl font-bold">
                            {fullTitle(valueName, item.text.type, item.text.book?.author, item.text.start)}
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
                ))}
            </section>
    );
};

export default DayPart;

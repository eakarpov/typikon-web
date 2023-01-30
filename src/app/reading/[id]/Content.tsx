import TextPart from "@/app/components/TextPart";
import {isFootnoteBook} from "@/utils/texts";

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

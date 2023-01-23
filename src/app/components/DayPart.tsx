import {TextType, valueTitle} from "@/utils/texts";
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
            <section className="space-y-2">
                <h1 className="text-2xl font-bold">
                    {valueTitle(valueName)}
                </h1>
                {value.items?.map((item: any) => item.text && (
                    <div key={item.text._id.toString()}>
                        <p>
                            Типикон говорит: {item.cite}
                        </p>
                        <p>
                            Автор: {item.text.book?.author}
                        </p>
                        <div className="space-y-1">
                            {item.text.content?.split("\n\n").map((paragraph: string, j: number) => (
                                <p key={paragraph} className="text-justify font-serif first-letter:text-red-600">
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
                    </div>
                ))}
            </section>
    );
};

export default DayPart;

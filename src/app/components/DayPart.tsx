import {fullTitle, isFootnoteBook, printTextReadiness, TextReadiness, TextType, valueTitle} from "@/utils/texts";
import TextPart from "@/app/components/TextPart";
import {ArrowTopRightOnSquareIcon} from "@heroicons/react/24/outline";

export interface IReadDayPart {
    value: any;
    valueName: TextType;
    paschal?: boolean;
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

const StartPart = ({ part }: { part: TextType }) => {
    switch (part) {
        case TextType.KATHISMA_1:
        case TextType.KATHISMA_2:
        case TextType.KATHISMA_3:
        case TextType.SONG_3:
            return (
                <span className="font-serif">
                    <span className="text-red-600">
                        И чтутся седальны по обычаю. По скончании же седальнов, глаголет учиненный чтец:
                    </span> Толкование Иоанна Златоуста благослови, владыко, прочести. <span className="text-red-600">
                        (Или иное название перваго чтения с испрошением благословения). И отвещает иерей:
                    </span> Молитвами святых отец наших Господи, Иисусе Христе Боже наш, помилуй нас. <span className="text-red-600">
                        И чтец:
                    </span> Аминь. <span className="text-red-600">
                        И начинает чтение.
                    </span>
                </span>
            );
        case TextType.SONG_6:
            return (
                <span className="font-serif">
                    <span className="text-red-600">
                        И поется кондак и икос (аще имать). Абие глаголет учиненный чтец:
                    </span> Синаксарь в неделю пентикостную благослови, владыко, прочести. <span className="text-red-600">
                        (Или иное название перваго чтения с испрошением благословения). И отвещает иерей:
                    </span> Молитвами святых отец наших Господи, Иисусе Христе Боже наш, помилуй нас. <span className="text-red-600">
                        И чтец:
                    </span> Аминь. <span className="text-red-600">
                        И начинает чтение.
                    </span>
                </span>
            );
        case TextType.VIGIL:
            return (
                <span className="font-serif">
                    <span className="text-red-600">
                        На бдении по священнику благословившу:
                    </span> Благословение Господне на вас, Того благодатию и человеколюбием всегда ныне и присно и во веки веков <span className="text-red-600">
                        поет лик:
                    </span> Аминь. <span className="text-red-600"> Аще праздник Пасхи, поем трижды
                    </span> Христос Воскресе. <span className="text-red-600">
                        И глаголет учиненный чтец:
                    </span> Слово Иоанна Златоустаго благослови, владыко, прочести. <span className="text-red-600">
                        (Или
                    </span> Деяний святых апостол<span className="text-red-600">
                        , или ино название первого чтения вкупе с прошением благословения) И отвещает иерей:
                    </span> Молитвами святых отец наших Господи, Иисусе Христе Боже наш, помилуй нас. <span className="text-red-600">
                        И чтец:
                    </span> Аминь. <span className="text-red-600">
                        И начинает чтение.
                    </span>
                </span>
            );
    }
  return null;
};

const EndPart = ({ part }: { part: TextType }) => {
    switch (part) {
        case TextType.KATHISMA_1:
        case TextType.KATHISMA_2:
        case TextType.KATHISMA_3:
        case TextType.SONG_3:
        case TextType.SONG_6:
            return (
                <span className="font-serif">
                    <span className="text-red-600">
                        По окончании же всего чтения, возглашает священник:
                    </span> Богу нашему слава, всегда ныне и присно и во веки веков. <span className="text-red-600">
                        И чтец:
                    </span> Аминь. <span className="text-red-600">
                        И далее по обычаю службы.
                    </span>
                </span>
            );
        case TextType.VIGIL:
            return (
                <span className="font-serif">
                    <span className="text-red-600">
                        По окончании же всего чтения, возглашает священник:
                    </span> Богу нашему слава, всегда ныне и присно и во веки веков. <span className="text-red-600">
                        И чтец:
                    </span> Аминь. <span className="text-red-600">
                        И чтется шестопсалмие утрени.
                    </span>
                </span>
            );
    }
    return null;
};

const DayPart = ({
    value,
    valueName,
    paschal,
}: IReadDayPart) => {
    return value?.items && (
            <section className="space-y-2" id={valueName}>
                <p className="text-1xl font-bold font-serif text-red-600">
                    {valueTitle(valueName)}:
                </p>
                <StartPart part={valueName} />
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
                        {item.description && (
                            <p className="font-serif text-red-600">
                                {item.description}
                            </p>
                        )}
                        {item.cite && (
                            <p className="font-serif text-red-600">
                                <strong>Типикон:</strong> {item.cite}
                            </p>
                        )}
                        {item.text.description && (
                            <p className="font-serif text-red-600">
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
                ) : paschal && !item.paschal && (
                    <div>
                        <strong>{valueTitle(valueName)} календарное чтение (Пролог, похвальное слово святому)</strong> - смотри соответствующий день в календарных чтениях
                    </div>
                ))}
                <EndPart part={valueName} />
            </section>
    );
};

export default DayPart;

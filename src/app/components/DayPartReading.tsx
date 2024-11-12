'use client';
import {fullTitle, isFootnoteBook, printTextReadiness, TextReadiness, TextType, valueTitle} from "@/utils/texts";
import {BookOpenIcon, InformationCircleIcon} from "@heroicons/react/24/outline";
import Link from "next/link";
import {useCallback, useState} from "react";
import reactStringReplace from "react-string-replace";
import FootnoteLinkNew from "@/app/components/FootnoteLinkNew";

export interface IReadDayPart {
    value: any;
    valueName: TextType;
    paschal?: boolean;
}

export const ReadinessButton = ({ value }: { value: TextReadiness }) => {
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

const StartPart = ({ part, firstText }: { part: TextType, firstText?: any; }) => {
    const stubText = !firstText?.text?.startPhrase && `(Или иное название перваго чтения с испрошением благословения)`;

    switch (part) {
        case TextType.VIGIL:
            return (
                <span className="font-serif">
                    <span className="text-red-600">
                        На бдении по еже благословити иерею:
                    </span> Благословение Господне на вас, Того благодатию и человеколюбием всегда ныне и присно и во веки веков <br/>
                    <span className="text-red-600">Поет лик:</span> Аминь.<br/>
                    <span className="text-red-600">И глаголет учиненный чтец:</span> {firstText?.text?.startPhrase || `Деяний святых апстол благослови, владыко, прочести.`} <span className="text-red-600">{stubText}<br/>
                        И отвещает иерей:</span> {firstText?.text?.initialPriestExclamation || `Молитвами святых отец наших Господи, Иисусе Христе Боже наш, помилуй нас.`}<br/>
                    <span className="text-red-600">И чтец:</span> Аминь.
                </span>
            );
        case TextType.KATHISMA_1:
        case TextType.KATHISMA_2:
        case TextType.KATHISMA_3:
        case TextType.POLYELEOS:
        case TextType.SONG_3:
            return (
                <span className="font-serif">
                    <span className="text-red-600">
                        Чтутся седальны по обычаю.<br/>
                        Абие учиненный чтец:</span> {firstText?.text?.startPhrase || `Толкование Иоанна Златоуста благослови, владыко, прочести.`} <span className="text-red-600">{stubText}<br/>
                        Иерей:</span> {firstText?.text?.initialPriestExclamation || `Молитвами святых отец наших Господи, Иисусе Христе Боже наш, помилуй нас.`}<br/>
                    <span className="text-red-600">И чтец:</span> Аминь.
                </span>
            );
        case TextType.IPAKOI:
            return (
                <span className="font-serif">
                    <span className="text-red-600">
                        Поется ипакои.<br/>
                        Абие учиненный чтец:</span> {firstText?.text?.startPhrase || `Толкование Иоанна Златоуста благослови, владыко, прочести.`} <span className="text-red-600">{stubText}<br/>
                        Иерей:</span> {firstText?.text?.initialPriestExclamation || `Молитвами святых отец наших Господи, Иисусе Христе Боже наш, помилуй нас.`}<br/>
                    <span className="text-red-600">И чтец:</span> Аминь.
                </span>
            );
        case TextType.SONG_6:
            return (
                <span className="font-serif">
                    <span className="text-red-600">
                        И поется кондак и икос (или мученичен, аще несть).<br/>
                        Абие учиненный чтец: </span> {firstText?.text?.startPhrase || `Синаксарь в неделю пентикостную благослови, владыко, прочести.`} <span className="text-red-600">{stubText}<br/>
                        Иерей:</span>{firstText?.text?.initialPriestExclamation || `Молитвами святых отец наших Господи, Иисусе Христе Боже наш, помилуй нас.`}<br/>
                    <span className="text-red-600">И чтец:</span> Аминь.
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
                        По скончании же всего чтения, возглашает иерей:
                    </span> Богу нашему слава, всегда ныне и присно и во веки веков. <br/>
                    <span className="text-red-600">
                        И чтец:
                    </span> Аминь. <br/>
                    <span className="text-red-600">
                        И далее по обычаю службы.
                    </span>
                </span>
            );
        case TextType.VIGIL:
            return (
                <span className="font-serif">
                    <span className="text-red-600">
                        По скончании же всего чтения, возглашает иерей:
                    </span> Богу нашему слава, всегда ныне и присно и во веки веков. <span className="text-red-600">
                        И чтец:
                    </span> Аминь. <span className="text-red-600">
                        [Аще Пасха, поется </span>Христос воскресе:<span className="text-red-600">] И чтется шестопсалмие утрени.
                    </span>
                </span>
            );
    }
    return null;
};

const DayPartReading = ({
    value,
    valueName,
    paschal,
}: IReadDayPart) => {
    const [showDescription, setShowDescription] = useState(false);
    const [showTitle, setShowTitle] = useState(false);

    const onShowTitle = useCallback(() => {
        setShowTitle(true);
    }, []);

    const onHideTitle = useCallback(() => {
        setShowTitle(false);
    }, []);

    const onShowDescription = useCallback(() => {
        setShowDescription(true);
    }, []);

    const onHideDescription = useCallback(() => {
        setShowDescription(false);
    }, []);

    return value?.items && (
            <section className="space-y-2" id={valueName}>
                <p className="text-1xl font-bold font-serif text-red-600">
                    {valueTitle(valueName)}:
                </p>
                <StartPart part={valueName} firstText={value.items[0]} />
                {value.items?.map((item: any, index: number) => item.text ? (
                    <div key={item.text._id}>
                        <div className="flex flex-row">
                            <Link
                                href={`/reading/${item.text._id}`}
                                onMouseLeave={onHideTitle}
                                onMouseEnter={onShowTitle}
                            >
                                <BookOpenIcon className="w-6 h-6" />
                            </Link>
                            <div
                                onMouseEnter={onShowDescription}
                                onMouseLeave={onHideDescription}
                            >
                                <InformationCircleIcon className="w-6 h-6" />
                            </div>
                            {showDescription && item.cite && (
                                <p className="font-serif text-red-600">
                                    <strong>Типикон:</strong> {item.cite}
                                </p>
                            )}
                            {showTitle && (
                                <p className="font-serif text-red-600">
                                    <strong>Название:</strong> {fullTitle(item.text.type, item.text.book?.author, item.text.start)}
                                </p>
                            )}
                        </div>
                        {item.description && (
                            <p className="font-serif text-red-600">
                                {item.description}
                            </p>
                        )}
                        {index > 0 && (item.text?.startPhrase || item.text?.name) && (
                            <p className="font-serif text-red-600">
                                {item.text?.startPhrase || item.text?.name}
                            </p>
                        )}
                        {item.text?.poems && (
                            <div className="space-y-1 mt-2">
                                <p className="font-serif">
                                    <b>Стихи́:</b>
                                </p>
                                {item.text.poems.split("\n").map((verse: string) => (
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
                            {item.text.content?.split("\n\n").map((paragraph: string, j: number) => (
                                <p
                                    key={paragraph}
                                    className="whitespace-pre-wrap text-justify text-lg font-serif first-letter:text-red-600"
                                >
                                    {reactStringReplace(
                                        reactStringReplace(
                                            reactStringReplace(
                                                reactStringReplace(
                                                    paragraph,
                                                    /\{st\|(.+)}/g,
                                                    (results) => <Link
                                                        href={`/saints/${results.split('|')[0]}`}
                                                        className="text-blue-800"
                                                    >
                                                        {results.split('|')[1]}
                                                    </Link>,
                                                ),
                                                /\{pl\|(.+)}/g,
                                                (results) => <Link
                                                    href={`/places/${results.split('|')[0]}`}
                                                    className="text-blue-800"
                                                >
                                                    {results.split('|')[1]}
                                                </Link>,
                                            ),
                                            /\{(\d+)}/g,
                                            (footnote) => <FootnoteLinkNew footnotes={item.text.footnotes} value={footnote} />,
                                        ),
                                        /\{k\|(.+)}/,
                                        (red) => (
                                            <span className="text-red-600">
                                                {red}
                                            </span>
                                        )
                                    )}
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

export default DayPartReading;

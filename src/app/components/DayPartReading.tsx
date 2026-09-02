'use client';
import {fullTitle, isFootnoteBook, printTextReadiness, TextReadiness, TextType, valueTitle} from "@/utils/texts";
import {BookOpenIcon, InformationCircleIcon} from "@heroicons/react/24/outline";
import Link from "next/link";
import {useCallback, useMemo, useState} from "react";
import reactStringReplace from "react-string-replace";
import FootnoteLinkNew from "@/app/components/FootnoteLinkNew";
import {bibleLanguageSubstitution} from "@/utils/bibleLanguage";

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
        case TextType.BEFORE_50:
            return (
                <span className="font-serif">
                    <span className="text-red-600">
                        Чтется 7-е Евангелие святых страстей.
                        И абие учиненный чтец: </span> {firstText?.text?.startPhrase || `Слово святаго Ефрема о святых страстей благослови, владыко, прочести.`}<br/><span className="text-red-600">
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

const getStatias = (content: string) => {
  const regSreda = /\[Среда:]/; // Для ввода ударения если получится, использовать отдельный кейс
  if (regSreda.test(content)) {
      const parts = content.split(regSreda);
      return parts;
  } else {
      const regStatias = /\[Статия \d+]/; // Для учета двоеточия или ударения если нужно - отдельный кейс, чтобы не сломать обратную совместимость
      if (regStatias.test(content)) {
          const parts = content.split(regStatias);
          return parts;
      } else {
          return [content];
      }
  }
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

    const getContent = (item: any) => {
        const statia = (item.statia - 1) || 0;
        const parts = getStatias(item.text.content);
        return parts[statia] || "";
    };

    const renderVerseMarkup = (text: string) => reactStringReplace(
        reactStringReplace(
            text,
            /\{st\|(.+)}/g,
            (results) => <Link href={`/saints/${results.split('|')[0]}`} className="text-blue-800">{results.split('|')[1]}</Link>,
        ),
        /\{pl\|(.+)}/g,
        (results) => <Link href={`/places/${results.split('|')[0]}`} className="text-blue-800">{results.split('|')[1]}</Link>,
    );

    const renderPericopeItem = (item: any, index: number) => {
        const substitution = bibleLanguageSubstitution(
            item.pericope.requestedLang, item.pericope.resolvedLang);
        const versesByChapter: [number, any[]][] = [];
        (item.pericope.verses || []).forEach((v: any) => {
            const last = versesByChapter[versesByChapter.length - 1];
            if (last && last[0] === v.chapter) last[1].push(v);
            else versesByChapter.push([v.chapter, [v]]);
        });

        return (
            <div key={item.pericope.id + index}>
                <div className="flex flex-row items-center">
                    {/* В книгу — сразу на ту главу, с которой чтение начинается:
                        адрес канонический, поэтому ведёт в нужное место в любом
                        издании, а не только в том, откуда стихи взяты сейчас. */}
                    {item.pericope.bookSlug && (
                        <Link href={`/bible/${item.pericope.bookSlug}/${item.pericope.ranges?.[0]?.chapterFrom ?? 1}`}>
                            <BookOpenIcon className="w-6 h-6" />
                        </Link>
                    )}
                    <span className="font-serif text-red-600 pl-1">{item.pericope.label}</span>
                </div>
                {item.description && (
                    <p className="font-serif text-red-600">{item.description}</p>
                )}
                {/* Чтение отдано не тем языком, что выбран, — говорим об этом.
                    Молчать нельзя: с частичным переводом (одно Четвероевангелие)
                    подмена пойдёт на каждой второй службе, и читатель решил бы,
                    что его выбор просто не работает. */}
                {substitution && (
                    <p className="font-serif text-sm text-amber-700">{substitution}</p>
                )}
                {!item.pericope.verses ? (
                    <p className="font-serif text-slate-400">
                        Не удалось собрать стихи (книга ещё не размечена ни для одного языка)
                    </p>
                ) : (
                    versesByChapter.map(([chapter, verses]) => (
                        <p key={chapter} className="whitespace-pre-wrap text-justify text-lg font-serif">
                            {verses.map((v: any) => (
                                <span key={v.id}>
                                    <sup className="text-red-600 font-bold">{v.verse}</sup>{" "}
                                    {/* Стих, которого нет в самом издании: показан
                                        приглушённо и с крестиком, а под чтением
                                        сказано, откуда он и почему его нет. Молча
                                        пропустить нельзя — чтение вышло бы короче
                                        того, что читают рядом на другом языке. */}
                                    {v.absent ? (
                                        <span className="text-slate-500">
                                            {renderVerseMarkup(v.content)}
                                            <sup className="text-slate-500">†</sup>
                                        </span>
                                    ) : renderVerseMarkup(v.content)}{" "}
                                </span>
                            ))}
                        </p>
                    ))
                )}
                {(item.pericope.verses || [])
                    .filter((v: any) => v.absent)
                    .map((v: any) => (
                        <p key={`absent-${v.id}`} className="font-serif text-sm text-slate-500">
                            † {v.chapter}:{v.verse} — этого стиха в издании нет:{" "}
                            {v.absent.why} Здесь он показан по традиции, {v.absent.supplied}.
                        </p>
                    ))}
            </div>
        );
    };

    return value?.items && (
            <section className="space-y-2" id={valueName}>
                <p className="text-1xl font-bold font-serif text-red-600">
                    {valueTitle(valueName)}:
                </p>
                <StartPart part={valueName} firstText={value.items[0]} />
                {value.items?.map((item: any, index: number) => item.pericope ? renderPericopeItem(item, index) : item.text ? (
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
                            {getContent(item)?.split("\n\n").map((paragraph: string, j: number) => (
                                <p
                                    key={paragraph}
                                    className={
                                        `whitespace-pre-wrap text-justify text-lg ${
                                            item.text.csSource ? "font-sans-serif" : "font-serif"
                                        } first-letter:text-red-600`
                                    }
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

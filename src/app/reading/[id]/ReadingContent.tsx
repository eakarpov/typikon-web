'use client';
import React, {memo, MouseEventHandler, useCallback, useEffect, useRef, useState} from "react";
import reactStringReplace from "react-string-replace";
import Link from "next/link";
import './reading.scss';
import "./highlight.css";
import Modal from "react-modal";
import FootnoteLinkNew from "@/app/components/FootnoteLinkNew";
import {useAppDispatch, useAppSelector} from "@/lib/hooks";
import {AuthSlice} from "@/lib/store/auth";
import TextNote from "@/app/reading/[id]/TextNote";
import {useRouterHash} from "@/app/reading/[id]/useRouterHash";
import {csFont, myFont} from "@/utils/font";
import {TextContentType} from "@/utils/texts";

const customStyles = {
    content: {
        top: '50%',
        left: '50%',
        right: 'auto',
        bottom: 'auto',
        marginRight: '-50%',
        transform: 'translate(-50%, -50%)',
    },
};

const customStylesSmall = {
    content: {
        top: '80%',
        left: '10%',
        height: '100px',
        transform: 'translate(-10%, -80%)',
    },
    overlay: {
        background: 'transparent'
    },
};

// matchStart — офсет начала word внутри paragraph/verseText, только для
// подсветки в модалке (slice+<mark>), на бекенд не отправляется.
interface ISelection {
    type: 'paragraph' | 'verse';
    word: string;
    wordIndex: number;
    matchStart: number;
    paragraphIndex?: number;
    paragraph?: string;
    chapter?: number;
    verse?: number;
    verseText?: string;
}

const ReadingContent = ({ item }: { item: any }) => {
    const [selection, setSelection] = useState<ISelection|null>(null);
    const [modalIsOpen, setModalIsOpen] = useState(false);
    const [correction, setCorrection] = useState("");

    const [isOpenContextMenuMobile, setIsOpenContextMenuMobile] = useState(false);

    const [clicked, setClicked] = useState(false);
    const [points, setPoints] = useState({
        x: 0,
        y: 0,
    });

    const dispatch = useAppDispatch();
    const isAuthorized = useAppSelector(state => state.auth.isAuthorized);

    const [notes, setNotes] = useState([]);
    const [isHovered, setIsHovered] = useState<number|null>(null);

    const hash = useRouterHash();;

    const onContextMenuHandler: MouseEventHandler = useCallback((e) => {
        const large = window.screen.width >= 600;
        if (selection) {
            e.preventDefault();
            if (large) {
                setClicked(true);
                setPoints({
                    x: e.pageX,
                    y: e.pageY,
                });
                window.addEventListener("click", () => setClicked(false), { once: true });
            } else {
                setIsOpenContextMenuMobile(true);
            }
        } else if (
            !large && isAuthorized
        ) {
            setIsOpenContextMenuMobile(true);
        }
    }, [selection, isAuthorized]);

    const onSendError = useCallback(() => {
        setIsOpenContextMenuMobile(false);
        setModalIsOpen(true);
    }, [selection]);

    const closeModal = useCallback(() => {
        setModalIsOpen(false);
        setSelection(null);
    }, []);

    // userId раньше слался в теле и ничем не проверялся — бекенд теперь сам
    // берёт userId из сессии (см. typikon-web /api/report), так что поле
    // убрано из payload вовсе. Статус ответа теперь реально проверяется:
    // раньше .then() без проверки res.ok показывал "успешно" даже на 401
    // (например, когда JWT сессии истёк за час, пока открыта вкладка) —
    // теперь при 401 сбрасываем протухший isAuthorized в сторе и просим
    // войти заново, вместо ложного "успешно".
    const onSendReport = useCallback(() => {
        if (!selection) return;
        const { matchStart, ...selectionPayload } = selection;
        const payload = { selection: selectionPayload, correction, textId: item.id };
        setModalIsOpen(false);
        setSelection(null);
        setCorrection("");
        fetch("/api/report", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }).then((res) => {
            if (res.status === 401) {
                dispatch(AuthSlice.actions.Logout());
                alert("Сессия истекла — войдите заново, чтобы отправить отчёт.");
                return;
            }
            if (!res.ok) {
                alert("Ошибка при отправлении отчета!");
                return;
            }
            alert("Отчет отправлен успешно!");
        }).catch(() => {
            alert("Ошибка при отправлении отчета!")
        });
    }, [selection, correction, item.id, dispatch]);

    // Раньше офсеты/"предложение" вычислялись через анкор-офсет + разбиение
    // текста узла по точкам — ломалось на любой точке в выделении (даже не
    // на границе предложений — "т.д.", "Мф. 5:3" и т.п.), терялось при
    // выделении в обратном направлении (anchor не всегда = начало Range) и
    // не работало, если выделение задевало соседний узел разметки (сноска/
    // ссылка на святого разбивает абзац на несколько текстовых узлов).
    // Теперь — обычный Range (всегда в порядке документа, независимо от
    // направления выделения) + ближайший размеченный контейнер
    // (data-report-container на <p>/<span> стиха), а не эвристика по тексту.
    const onSelectionChange = () => {
        if (!isAuthorized) return;
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
        const rawSelected = sel.toString();
        const word = rawSelected.trim();
        if (!word) return;
        // Пользователь мог задеть пробел на границе (двойной клик + протяжка,
        // выделение с самого края слова) — selected.toString() это сохраняет,
        // а matchStart должен указывать на начало word (без пробела), иначе
        // подсветка в модалке съедет на длину этого пробела.
        const leadingTrimmed = rawSelected.length - rawSelected.trimStart().length;

        const range = sel.getRangeAt(0);
        const anchorEl = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
            ? range.commonAncestorContainer.parentElement
            : range.commonAncestorContainer as Element;
        const container = anchorEl?.closest<HTMLElement>('[data-report-container]');
        if (!container) return; // выделение вне абзаца/стиха или через несколько сразу — не репортим

        const fullText = container.textContent || "";
        const preRange = document.createRange();
        preRange.selectNodeContents(container);
        preRange.setEnd(range.startContainer, range.startOffset);
        const matchStart = preRange.toString().length + leadingTrimmed;
        const before = fullText.slice(0, matchStart).trim();
        const wordIndex = before ? before.split(/\s+/).length : 0;

        if (container.dataset.chapter && container.dataset.verse) {
            setSelection({
                type: 'verse',
                word,
                wordIndex,
                matchStart,
                chapter: Number(container.dataset.chapter),
                verse: Number(container.dataset.verse),
                verseText: fullText,
            });
        } else {
            setSelection({
                type: 'paragraph',
                word,
                wordIndex,
                matchStart,
                paragraphIndex: Number(container.dataset.paragraphIndex || 0),
                paragraph: fullText,
            });
        }
    };

    const handlerHovered = useCallback((num: number|null) => () => {
        setIsHovered(num);
    }, []);

    const renderMarkup = useCallback((text: string) => reactStringReplace(
        reactStringReplace(
            reactStringReplace(
                reactStringReplace(
                    reactStringReplace(
                        text,
                        /note_(\d+)#/g,
                        (results) => <TextNote value={results} hash={hash} />
                    ),
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
            (footnote) => <FootnoteLinkNew footnotes={item.footnotes} value={footnote} />,
        ),
        /\{k\|(.+)}/,
        (red) => (
            <span className="text-red-600">
                {red}
            </span>
        )
    ), [hash, item.footnotes]);

    const versesByChapter = React.useMemo(() => {
        if (!item.verses) return [];
        const groups = new Map<number, any[]>();
        item.verses.forEach((v: any) => {
            const chapterVerses = groups.get(v.chapter) || [];
            chapterVerses.push(v);
            groups.set(v.chapter, chapterVerses);
        });
        return [...groups.entries()].sort(([a], [b]) => a - b);
    }, [item.verses]);

    useEffect(() => {
        const paragraph = document.getElementById("text-reading")
            ?.getElementsByTagName('p');
        const myP = paragraph![0];
        if (!myP) return;

        const treeWalker = document.createTreeWalker(myP, NodeFilter.SHOW_TEXT);
        const allTextNodes: Node[] = [];
        let currentNode = treeWalker.nextNode();
        while (currentNode) {
            allTextNodes.push(currentNode);
            currentNode = treeWalker.nextNode();
        }
        // @ts-ignore
        if (!CSS.highlights) {
            console.log("CSS highlight is not supported");
            return;
        }
        // @ts-ignore
        CSS.highlights.clear();

        const ranges = allTextNodes
            .map((el) => {
                const q = item.quotes?.find((el: any, i: number) => i === isHovered);
                if (!q) return;
                const start = el.nodeValue?.indexOf(q.value);
                if (!start || start < 0) return;
                const range = new Range();
                range.setStart(el, start);
                range.setEnd(el, start + q.value.toString().length);
                return range;
            }).filter(el => el);
        // @ts-ignore
        const searchResultsHighlight = new Highlight(...ranges.flat());
        // @ts-ignore
        CSS.highlights.set("search-results", searchResultsHighlight);
    }, [item.quotes, isHovered]);

    useEffect(() => {
        fetch(`/api/notes?id=${item.id}`).then((res) => res.json()).then((data) => {
            setNotes(data);
        });
        const hash = typeof window !== "undefined" ? window.location.hash : "";
        if (hash) {
            const scrollToEl = document.getElementById(hash);
            if (scrollToEl) {
                scrollToEl.scrollIntoView(true);
            }
        }
    }, []);

    useEffect(() => {
        Modal.setAppElement('#text-reading');
        document.addEventListener("selectionchange", onSelectionChange);
        return () => {
            document.removeEventListener("selectionchange", onSelectionChange);
        }
    }, []);

    return (
        <div
            id="text-reading"
            className="space-y-1 mt-2 pb-2"
            onContextMenu={onContextMenuHandler}
        >
            <div
                className="context-menu"
                style={{
                    display: clicked ? "flex" : "none",
                    position: "fixed",
                    top: `${points.y - 75}px`,
                    left: `${points.x}px`,
                }}
            >
                <ul>
                    <li onClick={onSendError}>Сообщить об ошибке</li>
                </ul>
            </div>
            {item.contentType === TextContentType.VERSES ? (
                versesByChapter.map(([chapter, chapterVerses]) => (
                    <div key={chapter} className="space-y-1">
                        <p className="font-bold font-serif">
                            Глава {chapter}
                        </p>
                        <p
                            className={`${
                                item.csSource ? csFont.variable : ""
                            } text-justify text-lg ${
                                item.csSource ? "font-sans-serif" : "font-serif"
                            }`}
                        >
                            {chapterVerses.map((verse: any) => (
                                <span key={verse.id}>
                                    <sup className="text-red-600 font-bold">
                                        {verse.verse}
                                    </sup>
                                    {" "}
                                    <span
                                        data-report-container
                                        data-chapter={chapter}
                                        data-verse={verse.verse}
                                    >
                                        {renderMarkup(verse.content)}
                                    </span>
                                    {" "}
                                </span>
                            ))}
                        </p>
                    </div>
                ))
            ) : (
                item.content?.split("\n\n").map((paragraph: string, paragraphIndex: number) => (
                    <p
                        key={paragraph}
                        data-report-container
                        data-paragraph-index={paragraphIndex}
                        className={`${
                            item.csSource ? csFont.variable : ""
                        } whitespace-pre-wrap text-justify text-lg ${
                            item.csSource ? "font-sans-serif" : "font-serif"
                        } first-letter:text-red-600`}
                    >
                        {renderMarkup(paragraph)}
                    </p>
                ))
            )}
            {notes.length > 0 && (
                <div>
                    <h3 className="font-bold">Заметки:</h3>
                    {notes.map((note: any) => (
                        <Link
                            key={note.value}
                            href={`#note_${note.value}`}
                            className={`#note_${note.value}` === hash ? 'font-bold' : ''}
                        >
                            {note.title}
                        </Link>
                    ))}
                </div>
            )}
            {item.quotes?.length > 0 && (
                <div>
                    <h3 className="font-bold">Цитаты:</h3>
                    {item.quotes.map((quote: any, i: number) => (
                        <div
                            key={quote.value}
                            onMouseEnter={handlerHovered(i)}
                            onMouseLeave={handlerHovered(null)}
                        >
                            <cite>
                                {quote.value}
                            </cite>
                        </div>
                    ))}
                </div>
            )}
            <Modal
                isOpen={modalIsOpen}
                onRequestClose={closeModal}
                style={customStyles}
                contentLabel="Отчет об ошибке"
            >
                <div className="flex flex-col">
                    <button onClick={closeModal}>Закрыть</button>
                    <h2>Отправить отчет об ошибке</h2>
                    {selection ? (
                        <>
                            <span>Ошибка: <b>{selection.word}</b></span>
                            <label>
                                {selection.type === 'verse' ? `Стих ${selection.chapter}:${selection.verse}:` : 'Абзац:'}
                            </label>
                            <span>
                                {(() => {
                                    const contextText = (selection.type === 'verse' ? selection.verseText : selection.paragraph) || "";
                                    const start = selection.matchStart;
                                    const end = start + selection.word.length;
                                    return <>
                                        {contextText.slice(0, start)}
                                        <mark className="bg-blue-200">{contextText.slice(start, end)}</mark>
                                        {contextText.slice(end)}
                                    </>;
                                })()}
                            </span>
                            <label>
                                Предлагаемый вариант исправления:
                            </label>
                            <textarea
                                value={correction}
                                onChange={(e) => setCorrection(e.target.value)}
                                className="border"
                            />
                            <button onClick={onSendReport}>Отправить отчет</button>
                        </>
                    ) : (
                        <>
                            <span>Не выбран исходный текст для ошибки</span>
                        </>
                    )}
                </div>
            </Modal>
            {isOpenContextMenuMobile && (
                <div
                    className="context-menu"
                    style={{
                        height: '50px',
                        top: '80%',
                        position: 'fixed',
                        left: '10%',
                        width: 'fit-content',
                        display: 'flex',
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <ul>
                        <li onClick={onSendError}>Сообщить об ошибке</li>
                    </ul>
                </div>
            )}
        </div>
    );
};

export default memo(ReadingContent);

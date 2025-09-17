'use client';
import React, {memo, MouseEventHandler, useCallback, useEffect, useRef, useState} from "react";
import reactStringReplace from "react-string-replace";
import Link from "next/link";
import './reading.scss';
import "./highlight.css";
import Modal from "react-modal";
import FootnoteLinkNew from "@/app/components/FootnoteLinkNew";
import {useAppSelector} from "@/lib/hooks";
import TextNote from "@/app/reading/[id]/TextNote";
import {useRouterHash} from "@/app/reading/[id]/useRouterHash";

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

interface ISelection {
    rangeStart: number;
    rangeEnd: number;
    sentence: string;
    selection: string;
    text: string;
    sentenceStart: number;
    sentenceEnd: number;
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
    const sentenceRef = useRef<HTMLDivElement|null>(null);

    const isAuthorized = useAppSelector(state => state.auth.isAuthorized);
    const userId = useAppSelector(state => state.auth.userId);

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

    const afterOpenModal = useCallback(() => {
        const sentenceNode = document.getElementById("sentence-modal");
        const treeWalker = document.createTreeWalker(sentenceNode!, NodeFilter.SHOW_TEXT);
        const allTextNodes = [];
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
                const range = new Range();
                range.setStart(el, selection?.sentenceStart!);
                range.setEnd(el, selection?.sentenceEnd!);
                return range;
            });
        // @ts-ignore
        const searchResultsHighlight = new Highlight(...ranges.flat());
        // @ts-ignore
        CSS.highlights.set("search-results", searchResultsHighlight);
    }, [selection]);

    const closeModal = useCallback(() => {
        setModalIsOpen(false);
        setSelection(null);
    }, []);

    const onSendReport = useCallback(() => {
        fetch("/api/report", {
            method: "POST",
            body: JSON.stringify({
                userId,
                selection,
                correction,
                textId: item.id,
            })
        }).then(() => {
            alert("Отчет отправлен успешно!");
        }).catch(() => {
            alert("Ошибка при отправлении отчета!")
        });
        setCorrection("");
        setSelection(null);
        setModalIsOpen(false);
    }, [selection, correction]);

    const onSelectionChange = () => {
        if (!isAuthorized) return;
        const selected = window.getSelection() as Selection;
        if (selected.toString() && !selected.toString().includes('.')) {
            const rangeStart = selected.anchorOffset;
            const rangeEnd = selected.anchorOffset + selected.toString().length;
            let sentence = "";
            let sentenceStart = 0;
            let sentenceEnd = 0;
            let acc = 0;
            selected.anchorNode?.textContent?.split('.').reduce((p, c, index) => {
                acc = acc + (c.length - c.trim().length);
                if ((rangeStart > p) && (rangeEnd < (p + c.length))) { // single sentence
                    sentence = c.trim();
                    sentenceStart = rangeStart - p - acc - 1;
                    sentenceEnd = rangeEnd - p - acc - 1;
                }
                return p + c.length;
            }, 0);
            setSelection({
                rangeStart,
                rangeEnd,
                sentence,
                sentenceStart,
                sentenceEnd,
                selection: selected.toString(),
                text: selected.anchorNode?.textContent!,
            });
        }
    };

    const handlerHovered = useCallback((num: number|null) => () => {
        setIsHovered(num);
    }, []);

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
            className="space-y-1 mt-2"
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
            {item.content?.split("\n\n").map((paragraph: string) => (
                <p
                    key={paragraph}
                    className="whitespace-pre-wrap text-justify text-lg font-serif first-letter:text-red-600"
                >

                    {reactStringReplace(
                        reactStringReplace(
                            reactStringReplace(
                                reactStringReplace(
                                    reactStringReplace(
                                        paragraph,
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
                    )}
                </p>
            ))}
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
                onAfterOpen={afterOpenModal}
                onRequestClose={closeModal}
                style={customStyles}
                contentLabel="Отчет об ошибке"
            >
                <div className="flex flex-col">
                    <button onClick={closeModal}>Закрыть</button>
                    <h2>Отправить отчет об ошибке</h2>
                    {selection ? (
                        <>
                            <span>Ошибка: <b>{selection.selection}</b></span>
                            <label>
                                Предложение:
                            </label>
                            <span
                                id="sentence-modal"
                                ref={sentenceRef}
                            >
                                {selection.sentence}
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

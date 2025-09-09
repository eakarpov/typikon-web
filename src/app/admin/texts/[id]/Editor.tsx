"use client";

import {
    DneslovKind,
    footNotesToArray,
    printDneslovKind,
    printTextKind,
    printTextReadiness,
    TextKind,
    TextReadiness
} from "@/utils/texts";
import React, {KeyboardEventHandler, useCallback, useEffect, useState} from "react";
import Markdown from "react-markdown";
import Modal from "react-modal";
import "./highlight.css";

interface IQuote {
    rangeStart: number;
    rangeEnd: number;
    value: string;
}

interface INote {
    value: number;
    title: string;
    id?: string;
}

interface ISelection {
    rangeStart: number;
    rangeEnd: number;
    sentence: string;
    selection: string;
    text: string;
    sentenceStart: number;
    sentenceEnd: number;
}

const getMentionIds = (content: string) => {
  const matcher = content.matchAll(/\{st\|(.+)}/g);
  if (matcher) {
      return [...matcher].map((item) => item[1].split('|')[0]).filter(el => el);
  }

  return null;
};

const AdminEditor = ({ value }: any) => {
    const [footnotes, setFootnotes] = useState(
        value.footnotes?.map((e: string, i: number) => `${i + 1} ${e}`).join('\n') || ""
    );
    const [name, setName] = useState(value.name || "");
    const [start, setStart] = useState(value.start || "");
    const [bookIndex, setBookIndex] = useState(value.bookIndex || 0);
    const [description, setDescription] = useState(value.description || "");
    const [type, setType] = useState(value.type || TextKind.TEACHIND);
    const [readiness, setReadiness] = useState(value.readiness || TextReadiness.READY);
    const [content, setContent] = useState<string>(value.content || "");
    const [link, setLink] = useState(value.link || "");
    const [ruLink, setRuLink] = useState(value.ruLink || "");
    const [author, setAuthor] = useState(value.author || "");
    const [translator, setTranslator] = useState(value.translator || "");
    const [alias, setAlias] = useState(value.alias || "");
    const [poems, setPoems] = useState(value.poems || "");
    const [imageLink, setImageLink] = useState(value.images && value.images[0] || "");
    const [dneslovId, setDneslovId] = useState(value.dneslovId || "");
    const [dneslovEventId, setDneslovEventId] = useState(value.dneslovEventId || "");
    const [dneslovType, setDneslovType] = useState(value.dneslovType || DneslovKind.MEMORY);
    const [startPhrase, setStartPhrase] = useState(value.startPhrase);
    const [initialPriestExclamation, setInitialPriestExclamation] = useState(value.initialPriestExclamation);
    const [newUi, setNewUi] = useState(value.newUi || false);
    const [info, setInfo] = useState(value.info || "");
    const [adminInfo, setAdminInfo] = useState(value.adminInfo || "");
    const [quotes, setQuotes] = useState<Array<IQuote>>(value.quotes || []);
    const [notes, setNotes] = useState<Array<INote>>(value.notes || []);
    const [selection, setSelection] = useState<ISelection|null>(null);

    const [saved, setIsSaved] = useState(false);

    const [viewUi, setViewUi] = useState(false);

    const [modalIsOpen, setModalIsOpen] = useState(false);

    const closeModal = useCallback(() => setModalIsOpen(false), []);

    const openModal = useCallback(() => setModalIsOpen(true), []);

    const onRemoveNote = useCallback((index: number) => () => {
        setContent(old => old.replaceAll(new RegExp(`note_${index + 1}#`, "g"), ''));
        setNotes((old) => {
            return old.filter((el, i) => i !== index);
        });
    }, [setNotes]);

    const onAddNote = useCallback(() => {
        if (!selection) return;
        setContent((old) =>
            `${old.slice(0, selection.rangeStart)} note_${notes.length + 1}# ${old.slice(selection.rangeStart)}`
        );
        setNotes((old) => {
            return [...old, { value: old.length + 1, title: "" } as INote];
        })
    }, [setContent, notes, setNotes, selection]);

    const onAddQuote = useCallback(() => {
        if (!selection) return;
        setQuotes((old) => {
            return [...old, { value: selection.selection, rangeStart: selection.rangeStart, rangeEnd: selection.rangeEnd }];
        });
    }, [setQuotes, selection]);

    const onDeleteQuote = useCallback((index: number) => () => {
        setQuotes((old) => {
            return old.filter((el, i) => i !== index);
        });
    }, [setQuotes]);

    const onSelectQuotes = useCallback(() => {
        const sentenceNode = document.getElementById("current-text");
        const treeWalker = document.createTreeWalker(sentenceNode!, NodeFilter.SHOW_TEXT);
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

        const ranges = quotes.flatMap(
            (q) => {
               return allTextNodes
                    .map((el) => {
                        const range = new Range();
                        range.setStart(el, q?.rangeStart!);
                        range.setEnd(el, q?.rangeEnd!);
                        return range;
                    })
            });
        // @ts-ignore
        const searchResultsHighlight = new Highlight(...ranges.flat());
        // @ts-ignore
        CSS.highlights.set("search-results", searchResultsHighlight);

        const rangesNotes = notes.flatMap(
            (q) => {
                return allTextNodes
                    .map((el) => {
                        const start = el.nodeValue?.indexOf(`note_${q.value}#`);
                        if (!start || start < 0) return;
                        const range = new Range();
                        range.setStart(el, start);
                        range.setEnd(el, start + 6 + q.value.toString().length);
                        return range;
                    }).filter(el => el)
            });

        // @ts-ignore
        const searchResultsHighlightNotes = new Highlight(...rangesNotes.flat());
        // @ts-ignore
        CSS.highlights.set("notes", searchResultsHighlightNotes);
    }, [selection, quotes, notes, content]);

    const onSelectionChange = () => {
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

    const onChangeLabel = useCallback((index: number) => (e: any) => {
        const val = e.target.value;
        setNotes((old) => old.map((el, j) => {
            if (j === index) {
                return { ...el, title: val };
            }
            return el;
        }));
    }, [setNotes]);

    const onBufferClick = useCallback(() => {
        navigator.clipboard.writeText(`https://typikon.su/reading/${alias}`);
    }, [alias]);

    const onSubmit = () => {
        setIsSaved(false);
        const fNotes = footNotesToArray(footnotes);
        if (fNotes.includes(undefined)) {
            alert("Error with footnotes");
        }
        const mainProcess = fetch(`/api/admin/texts/${value.id}`, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name,
                type,
                start,
                description,
                content,
                bookIndex,
                readiness,
                author,
                translator,
                footnotes: fNotes,
                ruLink,
                link,
                alias,
                poems,
                images: [imageLink],
                mentionIds: getMentionIds(content),
                dneslovId,
                dneslovEventId,
                startPhrase,
                initialPriestExclamation,
                newUi,
                info,
                adminInfo,
                quotes,
            }),
        });
        const notesProcess = fetch(`/api/admin/texts/${value.id}/notes`, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(notes),
        });

        Promise.allSettled([mainProcess, notesProcess]).then(() => {
            setIsSaved(true);
        });
    };

    const onMouseDown: KeyboardEventHandler = useCallback((e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            onSubmit();
        }
    }, [onSubmit]);

    useEffect(() => {
        document.addEventListener("keydown", onMouseDown as unknown as EventListener);
        return () => {
            document.removeEventListener("keydown", onMouseDown as unknown as EventListener);
        };
    }, []);

    useEffect(() => {
        Modal.setAppElement('#text-editor');
        document.addEventListener("selectionchange", onSelectionChange);
        return () => {
            document.removeEventListener("selectionchange", onSelectionChange);
        }
    }, []);

    useEffect(() => {
        setTimeout(() => {
            const sentenceNode = document.getElementById("current-text");
            if (sentenceNode) {
                onSelectQuotes();
            }
        }, 0);
    }, [quotes, modalIsOpen, notes, content]);

    return (
        <div id="text-editor" className="flex flex-col">
            <button onClick={onSubmit}>
                {saved ? "Сохранено!" : "Сохранить"}
            </button>
            <label>
                Название
            </label>
            <input
                className="border-2"
                value={name}
                onChange={e => setName(e.target.value)}
            />
            <div className="flex flex-row flex-wrap">
                <div className="flex flex-col pr-4">
                    <label>
                        Готовность
                    </label>
                    <select
                        className="border-2"
                        value={readiness}
                        onChange={(event) => setReadiness(event.target.value)}
                    >
                        {Object.values(TextReadiness).map(val => (
                            <option
                                key={val}
                                value={val}
                            >
                                {printTextReadiness(val)}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col pr-4">
                    <label>
                        Тип
                    </label>
                    <select className="border-2" value={type} onChange={(event) => setType(event.target.value)}>
                        {Object.values(TextKind).map((val) => (
                            <option
                                key={val}
                                value={val}
                            >
                                {printTextKind(val)}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col pr-4">
                    <label>
                        Тип Днеслова
                    </label>
                    <select
                        className="border-2"
                        value={dneslovType}
                        onChange={(event) => setDneslovType(event.target.value)}
                    >
                        {Object.values(DneslovKind).map((val) => (
                            <option
                                key={val}
                                value={val}
                            >
                                {printDneslovKind(val)}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col pr-4">
                    <label>
                        Идентификатор Днеслова
                    </label>
                    <input
                        className="border-2"
                        value={dneslovId}
                        onChange={e => setDneslovId(e.target.value)}
                    />
                </div>
                <div className="flex flex-col pr-4">
                    <label>
                        Идентификатор события Днеслова
                    </label>
                    <input
                        className="border-2"
                        value={dneslovEventId}
                        onChange={e => setDneslovEventId(e.target.value)}
                    />
                </div>
                <div className="flex flex-col pr-4">
                    <label>
                        Порядковый номер
                    </label>
                    <input
                        className="border-2"
                        value={bookIndex}
                        onChange={e => setBookIndex(e.target.value)}
                    />
                </div>
                <div className="flex flex-col pr-4">
                    <label>
                        Отдельный автор
                    </label>
                    <input
                        className="border-2"
                        value={author}
                        onChange={e => setAuthor(e.target.value)}
                    />
                </div>
                <div className="flex flex-col pr-4">
                    <label>
                        Отдельный переводчик
                    </label>
                    <input
                        className="border-2"
                        value={translator}
                        onChange={e => setTranslator(e.target.value)}
                    />
                </div>
            </div>
            <div className="flex flex-row">
                <div className="flex flex-col pr-4 w-1/2">
                    <label>
                        Алиас записи
                    </label>
                    <input
                        className="border-2"
                        value={alias}
                        onChange={e => setAlias(e.target.value)}
                    />
                    <div
                        className="cursor-pointer"
                        onClick={onBufferClick}
                    >
                        Скопировать в буфер полный адрес
                    </div>
                </div>
                <div className="flex flex-col w-1/2">
                    <label>
                        Начало
                    </label>
                    <input
                        className="border-2"
                        value={start}
                        onChange={e => setStart(e.target.value)}
                    />
                </div>
            </div>
            <label>
                Описание
            </label>
            <input
                className="border-2"
                value={description}
                onChange={e => setDescription(e.target.value)}
            />
            <label>
                Ссылка на русский текст
            </label>
            <input
                className="border-2"
                value={ruLink}
                onChange={e => setRuLink(e.target.value)}
            />
            <label>
                Ссылка на церковнославянский текст/скан
            </label>
            <input
                className="border-2"
                value={link}
                onChange={e => setLink(e.target.value)}
            />
            <label>
                Начальная фраза
            </label>
            <input
                className="border-2"
                value={startPhrase}
                onChange={e => setStartPhrase(e.target.value)}
            />
            <label>
                Ответный возглас иерея
            </label>
            <input
                className="border-2"
                value={initialPriestExclamation}
                onChange={e => setInitialPriestExclamation(e.target.value)}
            />
            <div className="flex flex-row">
                <div className="flex flex-col pr-4 w-1/3">
                    <label>
                        Стихи
                    </label>
                    <textarea
                        className="border-2"
                        value={poems}
                        onChange={e => setPoems(e.target.value)}
                    />
                </div>
                <div className="flex flex-col pr-4 w-1/3">
                    <label>
                        Сноски
                    </label>
                    <textarea
                        className="border-2"
                        value={footnotes}
                        onChange={e => setFootnotes(e.target.value)}
                    />
                </div>
                <div className="flex flex-col w-1/3">
                    <label>
                        Икона (картина)
                    </label>
                    <input
                        className="border-2"
                        value={imageLink}
                        onChange={e => setImageLink(e.target.value)}
                    />
                </div>
            </div>
            <div className="flex flex-row">
                <div className="flex flex-row pr-4">
                    <label>
                        Новый UI (Markdown)
                    </label>
                    <input type="checkbox" value={newUi} onChange={e => setNewUi(!newUi)} />
                </div>
                {newUi && (
                    <>
                        <div
                            className={`flex flex-col border pr-4 ${viewUi && `font-bold`}`}
                            onClick={() => setViewUi(true)}
                        >
                            View
                        </div>
                        <div
                            className={`flex flex-col border pr-4 ${!viewUi && `font-bold`}`}
                            onClick={() => setViewUi(false)}
                        >
                            Code
                        </div>
                    </>
                )}
                <div
                    className={`cursor-pointer`}
                    onClick={openModal}
                >
                    Подробный редактор
                </div>
            </div>
            {newUi ? (
                <>
                    <label><b>Содержимое</b></label>
                    {viewUi ? (
                        <div>
                            <Markdown>
                                {content}
                            </Markdown>
                        </div>
                    ) : (
                        <textarea
                            className="border-2 h-48"
                            value={content}
                            onChange={e => setContent(e.target.value)}
                        />
                    )}
                </>
            ) : (
                <>
                    <label>
                        Содержимое
                    </label>
                    <textarea
                        className="border-2 h-48"
                        value={content}
                        onChange={e => setContent(e.target.value)}
                    />
                </>
            )}
            <div className="flex flex-row">
                <div className="flex flex-col pr-4 w-1/3">
                    <label>
                        P.S.
                    </label>
                    <textarea
                        className="border-2"
                        value={info}
                        onChange={e => setInfo(e.target.value)}
                    />
                </div>
                <div className="flex flex-col pr-4 w-1/3">
                    <label>
                        Комментарий (для админов)
                    </label>
                    <textarea
                        className="border-2"
                        value={adminInfo}
                        onChange={e => setAdminInfo(e.target.value)}
                    />
                </div>
            </div>
            <Modal
                isOpen={modalIsOpen}
                onRequestClose={closeModal}
                contentLabel="Редактор"
            >
                <div className="flex flex-col">
                    <button onClick={closeModal}>Закрыть</button>
                    <h2>Подробный редактор</h2>
                    <div className="flex flex-col">
                        <h3>Заметки</h3>
                        {notes.map((note: any, index: number) => (
                            <div key={index} className="flex flex-row">
                                <span>Заметка {index + 1}: </span>
                                <input
                                    className="w-1/2 border"
                                    value={note.title}
                                    onChange={onChangeLabel(index)}
                                />
                                <span
                                    className="cursor-pointer"
                                    onClick={onRemoveNote(index)}
                                >
                                    Удалить
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="flex flex-row">
                        <div className="flex flex-row pr-4" onClick={onAddNote}>
                            <label>
                                Добавить заметку
                            </label>
                        </div>
                        <div className="flex flex-row pr-4" onClick={onAddQuote}>
                            <label>
                                Добавить цитату
                            </label>
                        </div>
                    </div>
                    <div
                        id="current-text"
                        className="inline border pr-4"
                    >
                        {content}
                    </div>
                    <div className="flex flex-row">
                        <div className="flex flex-row pr-4">
                            <label>
                                Новый UI (Markdown)
                            </label>
                            <input type="checkbox" value={newUi} onChange={e => setNewUi(!newUi)} />
                        </div>
                    </div>
                    {newUi ? (
                        <div className="flex flex-row">
                            <textarea
                                className="border-2 h-48 w-1/2"
                                value={content}
                                onChange={e => setContent(e.target.value)}
                            />
                            <div className="w-1/2">
                                <Markdown>
                                    {content}
                                </Markdown>
                            </div>
                        </div>
                    ) : (
                        <textarea
                            className="border-2 h-48"
                            value={content}
                            onChange={e => setContent(e.target.value)}
                        />
                    )}
                    {quotes && (
                        <div>
                            <h3>Цитаты</h3>
                            <div>
                                {quotes.map((q, i) => (
                                    <div key={i}>
                                       <label>
                                           {q.value}
                                       </label>
                                        <span onClick={onDeleteQuote(i)}>
                                            Удалить
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default AdminEditor;

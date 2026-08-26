'use client';
import React, {memo, MouseEventHandler, useCallback, useEffect, useRef, useState} from "react";
import reactStringReplace from "react-string-replace";
import Markdown from "react-markdown";
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

// matchStart — офсет начала phrase внутри paragraph/verseText, только для
// подсветки (slice+<mark>), на бекенд не отправляется (кроме подсветки уже
// сохранённых заметок в тексте — там phrase используется как ключ поиска).
interface ISelection {
    type: 'paragraph' | 'verse';
    phrase: string;
    wordIndex: number;
    matchStart: number;
    paragraphIndex?: number;
    paragraph?: string;
    chapter?: number;
    verse?: number;
    verseText?: string;
}

interface IUserNote {
    id: string;
    selection: ISelection;
    note: string;
    createdAt: string;
    updatedAt: string;
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

    // userNotes — приватные заметки текущего пользователя (typikon-users.userNotes),
    // не путать с notes выше — это публичные редакторские сноски note_(\d+)# из typikon.notes.
    const [userNotes, setUserNotes] = useState<IUserNote[]>([]);
    const [activeNote, setActiveNote] = useState<IUserNote | null>(null);
    const [noteModalIsOpen, setNoteModalIsOpen] = useState(false);
    const [noteDraft, setNoteDraft] = useState("");

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

    const onAddNote = useCallback(() => {
        setIsOpenContextMenuMobile(false);
        setActiveNote(null);
        setNoteDraft("");
        setNoteModalIsOpen(true);
    }, []);

    const onClickNoteHighlight = useCallback((note: IUserNote) => {
        setActiveNote(note);
        setNoteDraft(note.note);
        setNoteModalIsOpen(true);
    }, []);

    const closeNoteModal = useCallback(() => {
        setNoteModalIsOpen(false);
        setActiveNote(null);
        setSelection(null);
    }, []);

    const onSaveNote = useCallback(() => {
        if (!selection || !noteDraft.trim()) return;
        const { matchStart, ...selectionPayload } = selection;
        const payload = { textId: item.id, selection: selectionPayload, note: noteDraft };
        setNoteModalIsOpen(false);
        setSelection(null);
        fetch("/api/user-notes", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }).then((res) => {
            if (res.status === 401) {
                dispatch(AuthSlice.actions.Logout());
                alert("Сессия истекла — войдите заново, чтобы сохранить заметку.");
                return null;
            }
            if (!res.ok) {
                alert("Не удалось сохранить заметку");
                return null;
            }
            return res.json();
        }).then((data) => {
            if (data?.id) {
                const now = new Date().toISOString();
                setUserNotes((prev) => [...prev, { id: data.id, selection: selectionPayload as ISelection, note: noteDraft, createdAt: now, updatedAt: now }]);
            }
        }).catch(() => {
            alert("Не удалось сохранить заметку");
        });
        setNoteDraft("");
    }, [selection, noteDraft, item.id, dispatch]);

    const onUpdateNote = useCallback(() => {
        if (!activeNote || !noteDraft.trim()) return;
        const noteId = activeNote.id;
        fetch(`/api/user-notes/${noteId}`, {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ note: noteDraft }),
        }).then((res) => {
            if (res.status === 401) {
                dispatch(AuthSlice.actions.Logout());
                alert("Сессия истекла — войдите заново.");
                return;
            }
            if (!res.ok) {
                alert("Не удалось сохранить изменения");
                return;
            }
            setUserNotes((prev) => prev.map((n) => n.id === noteId ? { ...n, note: noteDraft } : n));
        }).catch(() => {
            alert("Не удалось сохранить изменения");
        });
        setNoteModalIsOpen(false);
        setActiveNote(null);
    }, [activeNote, noteDraft, dispatch]);

    const onDeleteNote = useCallback(() => {
        if (!activeNote) return;
        const noteId = activeNote.id;
        fetch(`/api/user-notes/${noteId}`, {
            method: "DELETE",
            credentials: "include",
        }).then((res) => {
            if (res.status === 401) {
                dispatch(AuthSlice.actions.Logout());
                alert("Сессия истекла — войдите заново.");
                return;
            }
            if (!res.ok) {
                alert("Не удалось удалить заметку");
                return;
            }
            setUserNotes((prev) => prev.filter((n) => n.id !== noteId));
        }).catch(() => {
            alert("Не удалось удалить заметку");
        });
        setNoteModalIsOpen(false);
        setActiveNote(null);
    }, [activeNote, dispatch]);

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
        const phrase = rawSelected.trim();
        if (!phrase) return;
        // Пользователь мог задеть пробел на границе (двойной клик + протяжка,
        // выделение с самого края слова) — selected.toString() это сохраняет,
        // а matchStart должен указывать на начало phrase (без пробела), иначе
        // подсветка съедет на длину этого пробела.
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
                phrase,
                wordIndex,
                matchStart,
                chapter: Number(container.dataset.chapter),
                verse: Number(container.dataset.verse),
                verseText: fullText,
            });
        } else {
            setSelection({
                type: 'paragraph',
                phrase,
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
                        reactStringReplace(
                            reactStringReplace(
                                reactStringReplace(
                                    text,
                                    /note_(\d+)#/g,
                                    (results, i, offset) => <TextNote key={`note-${i}-${offset}`} value={results} hash={hash} />
                                ),
                                // Якорь правила: /reading/<раздел>#p-82 ведёт к 82-му правилу.
                                /\{a\|(\d+)}/g,
                                (rule, i, offset) => <span key={`rule-${i}-${offset}`} id={`p-${rule}`} className="scroll-mt-20" />,
                            ),
                            // Колонтитул печатного издания: привязка к листу оригинала.
                            /\{p\|([^}]+)}/g,
                            (page, i, offset) => (
                                <span key={`page-${i}-${offset}`} className="text-xs text-stone-400 align-super select-none px-1">
                                    {page}
                                </span>
                            ),
                        ),
                        // Ссылка на другой текст: так оглавление книги ведёт в её главы.
                        /\{t\|([^}]+)}/g,
                        (link, i, offset) => <Link
                            key={`text-${i}-${offset}`}
                            href={`/reading/${link.split('|')[0]}`}
                            className="text-blue-800"
                        >
                            {link.split('|')[1]}
                        </Link>,
                    ),
                    /\{st\|(.+)}/g,
                    (results, i, offset) => <Link
                        key={`saint-${i}-${offset}`}
                        href={`/saints/${results.split('|')[0]}`}
                        className="text-blue-800"
                    >
                        {results.split('|')[1]}
                    </Link>,
                ),
                /\{pl\|(.+)}/g,
                (results, i, offset) => <Link
                    key={`place-${i}-${offset}`}
                    href={`/places/${results.split('|')[0]}`}
                    className="text-blue-800"
                >
                    {results.split('|')[1]}
                </Link>,
            ),
            /\{(\d+)}/g,
            (footnote, i, offset) => <FootnoteLinkNew key={`fn-${i}-${offset}`} footnotes={item.footnotes} value={footnote} />,
        ),
        /\{k\|(.+)}/,
        (red, i, offset) => (
            <span key={`red-${i}-${offset}`} className="text-red-600">
                {red}
            </span>
        )
    ), [hash, item.footnotes]);

    // Оборачивает уже отрендеренный renderMarkup(...) результат ещё одним
    // проходом reactStringReplace, подсвечивая phrase каждой заметки этого
    // контейнера. Важно: идёт ПОСЛЕДНИМ (снаружи), а не встроен в цепочку
    // renderMarkup — reactStringReplace матчит только по строковым сегментам,
    // не трогая уже сконвертированные React-узлы (ссылки/сноски), так что
    // фраза, целиком попадающая в разметку, не задваивается. Обратная
    // сторона: если phrase заметки сама пересекает границу разметки (сноску/
    // ссылку), совпадение не найдётся ни в одном сегменте — такая заметка
    // не подсветится в тексте (при этом сама заметка не теряется, её видно
    // в профиле). Более длинные фразы match'атся раньше коротких.
    const highlightUserNotes = useCallback((rendered: any, notesForContainer: IUserNote[]) => {
        if (notesForContainer.length === 0) return rendered;
        const sorted = [...notesForContainer].sort((a, b) => b.selection.phrase.length - a.selection.phrase.length);
        const escaped = sorted.map((n) => n.selection.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).filter(Boolean);
        if (escaped.length === 0) return rendered;
        const combined = new RegExp(`(${escaped.join('|')})`, 'g');
        return reactStringReplace(rendered, combined, (match: string, i: number) => {
            const note = sorted.find((n) => n.selection.phrase === match);
            return (
                <mark
                    key={`usernote-${i}`}
                    className="bg-yellow-100 cursor-pointer"
                    title="Ваша заметка — нажмите, чтобы посмотреть"
                    onClick={() => note && onClickNoteHighlight(note)}
                >
                    {match}
                </mark>
            );
        });
    }, [onClickNoteHighlight]);

    // Тексты с newUi размечены markdown: он отвечает за начертание (жирный,
    // курсив), наши метки — за сноски, ссылки, колонтитулы и якоря. Поэтому
    // строковые куски, которые markdown отдаёт внутрь своих узлов, прогоняются
    // через ту же пару renderMarkup + подсветка заметок, что и обычные абзацы.
    const renderInline = useCallback((children: React.ReactNode, notesForContainer: IUserNote[]) =>
        React.Children.map(children, (child) =>
            typeof child === "string"
                ? highlightUserNotes(renderMarkup(child), notesForContainer)
                : child,
        ), [renderMarkup, highlightUserNotes]);

    // Абзац остаётся нашим контейнером (в нём data-paragraph-index, по которому
    // работают заметки и «сообщить об ошибке»), поэтому markdown-абзац рендерится
    // фрагментом, без вложенного <p>.
    // У церковнославянского Monomakh только одно начертание: ни жирного, ни курсива
    // в шрифте нет, и браузер рисует их синтетически — почти неразличимо. Поэтому
    // в церковнославянских текстах выделение делается рубрикацией, как в самих
    // богослужебных книгах: заголовок киноварью, подрубрика — приглушённым цветом.
    const markdownComponents = useCallback((notesForContainer: IUserNote[]) => ({
        p: ({ children }: any) => <>{renderInline(children, notesForContainer)}</>,
        strong: ({ children }: any) => (
            <strong className={item.csSource ? "font-normal text-red-800" : "font-bold"}>
                {renderInline(children, notesForContainer)}
            </strong>
        ),
        em: ({ children }: any) => (
            <em className={item.csSource ? "not-italic text-stone-500" : "italic"}>
                {renderInline(children, notesForContainer)}
            </em>
        ),
    }), [renderInline, item.csSource]);

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
        if (!isAuthorized) {
            setUserNotes([]);
            return;
        }
        fetch(`/api/user-notes?textId=${item.id}`, { credentials: "include" })
            .then((res) => res.ok ? res.json() : [])
            .then(setUserNotes)
            .catch(() => {});
    }, [item.id, isAuthorized]);

    useEffect(() => {
        fetch(`/api/notes?id=${item.id}`).then((res) => res.json()).then((data) => {
            setNotes(data);
        });
    }, []);

    // Прокрутка к якорю (#p-82 — правило, #note_3 — заметка). Браузер делает её до
    // гидратации, а потом содержимое над якорем меняет высоту — догружается
    // церковнославянский шрифт, приходят заметки. Поэтому доводим сами: на монтировании,
    // после загрузки шрифтов и после каждого прихода данных.
    const scrollToHash = useCallback(() => {
        const target = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
        if (!target) return;
        document.getElementById(target)?.scrollIntoView(true);
    }, []);

    useEffect(() => {
        scrollToHash();
        document.fonts?.ready.then(scrollToHash);
    }, [scrollToHash, notes, userNotes]);

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
                    <li onClick={onAddNote}>Добавить заметку</li>
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
                            {chapterVerses.map((verse: any) => {
                                const notesForVerse = userNotes.filter((n) =>
                                    n.selection.type === 'verse' && n.selection.chapter === chapter && n.selection.verse === verse.verse
                                );
                                return (
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
                                            {highlightUserNotes(renderMarkup(verse.content), notesForVerse)}
                                        </span>
                                        {" "}
                                    </span>
                                );
                            })}
                        </p>
                    </div>
                ))
            ) : (
                item.content?.split("\n\n").map((paragraph: string, paragraphIndex: number) => {
                    const notesForParagraph = userNotes.filter((n) =>
                        n.selection.type === 'paragraph' && n.selection.paragraphIndex === paragraphIndex
                    );
                    const Container = item.newUi ? "div" : "p";
                    return (
                        <Container
                            key={`paragraph-${paragraphIndex}`}
                            data-report-container
                            data-paragraph-index={paragraphIndex}
                            className={`${
                                item.csSource ? csFont.variable : ""
                            } ${item.newUi ? "" : "whitespace-pre-wrap"} text-justify text-lg ${
                                item.csSource ? "font-sans-serif" : "font-serif"
                            } first-letter:text-red-600`}
                        >
                            {item.newUi ? (
                                <Markdown components={markdownComponents(notesForParagraph)}>
                                    {paragraph}
                                </Markdown>
                            ) : (
                                highlightUserNotes(renderMarkup(paragraph), notesForParagraph)
                            )}
                        </Container>
                    );
                })
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
                            <span>Ошибка: <b>{selection.phrase}</b></span>
                            <label>
                                {selection.type === 'verse' ? `Стих ${selection.chapter}:${selection.verse}:` : 'Абзац:'}
                            </label>
                            <span>
                                {(() => {
                                    const contextText = (selection.type === 'verse' ? selection.verseText : selection.paragraph) || "";
                                    const start = selection.matchStart;
                                    const end = start + selection.phrase.length;
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
            <Modal
                isOpen={noteModalIsOpen}
                onRequestClose={closeNoteModal}
                style={customStyles}
                contentLabel="Заметка"
            >
                <div className="flex flex-col">
                    <button onClick={closeNoteModal}>Закрыть</button>
                    <h2>{activeNote ? "Заметка" : "Новая заметка"}</h2>
                    {(() => {
                        const effectiveSelection = activeNote ? activeNote.selection : selection;
                        if (!effectiveSelection) {
                            return <span>Не выбран текст для заметки</span>;
                        }
                        const contextText = (effectiveSelection.type === 'verse' ? effectiveSelection.verseText : effectiveSelection.paragraph) || "";
                        // matchStart не уходит на бекенд (как и у отчётов) — для
                        // заметки, только что выделенной на этой же странице, он
                        // есть в selection; для уже сохранённой (activeNote, пришла
                        // с сервера) его нет — ищем phrase заново.
                        const start = effectiveSelection.matchStart ?? contextText.indexOf(effectiveSelection.phrase);
                        const end = start + effectiveSelection.phrase.length;
                        return (
                            <>
                                <label>
                                    {effectiveSelection.type === 'verse' ? `Стих ${effectiveSelection.chapter}:${effectiveSelection.verse}:` : 'Абзац:'}
                                </label>
                                <span>
                                    {contextText.slice(0, start)}
                                    <mark className="bg-yellow-200">{contextText.slice(start, end)}</mark>
                                    {contextText.slice(end)}
                                </span>
                                <label>Ваша заметка:</label>
                                <textarea
                                    value={noteDraft}
                                    onChange={(e) => setNoteDraft(e.target.value)}
                                    className="border"
                                />
                                <div className="flex gap-2">
                                    {activeNote ? (
                                        <>
                                            <button onClick={onUpdateNote}>Сохранить</button>
                                            <button onClick={onDeleteNote}>Удалить</button>
                                        </>
                                    ) : (
                                        <button onClick={onSaveNote}>Сохранить заметку</button>
                                    )}
                                </div>
                            </>
                        );
                    })()}
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
                        <li onClick={onAddNote}>Добавить заметку</li>
                    </ul>
                </div>
            )}
        </div>
    );
};

export default memo(ReadingContent);

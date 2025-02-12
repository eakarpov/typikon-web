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
import React, {useCallback, useEffect, useState} from "react";
import Markdown from "react-markdown";

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
    const [content, setContent] = useState(value.content || "");
    const [link, setLink] = useState(value.link || "");
    const [ruLink, setRuLink] = useState(value.ruLink || "");
    const [author, setAuthor] = useState(value.author || "");
    const [translator, setTranslator] = useState(value.translator || "");
    const [alias, setAlias] = useState(value.alias || "");
    const [poems, setPoems] = useState(value.poems || "");
    const [imageLink, setImageLink] = useState(value.images && value.images[0] || "");
    const [dneslovId, setDneslovId] = useState(value.dneslovId || "");
    const [dneslovType, setDneslovType] = useState(value.dneslovType || DneslovKind.MEMORY);
    const [startPhrase, setStartPhrase] = useState(value.startPhrase);
    const [initialPriestExclamation, setInitialPriestExclamation] = useState(value.initialPriestExclamation);
    const [newUi, setNewUi] = useState(value.newUi || false);

    const [saved, setIsSaved] = useState(false);

    const [viewUi, setViewUi] = useState(false);

    const onBufferClick = useCallback(() => {
        navigator.clipboard.writeText(`https://typikon.su/reading/${alias}`);
    }, [alias]);

    const onSubmit = () => {
        setIsSaved(false);
        const fNotes = footNotesToArray(footnotes);
        if (fNotes.includes(undefined)) {
            alert("Error with footnotes");
        }
        fetch(`/api/admin/texts/${value.id}`, {
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
                startPhrase,
                initialPriestExclamation,
                newUi,
            }),
        }).then(() => {
            setIsSaved(true);
        });
    };
    return (
        <div className="flex flex-col">
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
        </div>
    );
};

export default AdminEditor;

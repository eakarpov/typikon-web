"use client";

import {footNotesToArray, printTextKind, printTextReadiness, TextKind, TextReadiness} from "@/utils/texts";
import {useCallback, useEffect, useState} from "react";

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

    const [saved, setIsSaved] = useState(false);

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
            <label>
                Начало
            </label>
            <input
                className="border-2"
                value={start}
                onChange={e => setStart(e.target.value)}
            />
            <label>
                Описание
            </label>
            <input
                className="border-2"
                value={description}
                onChange={e => setDescription(e.target.value)}
            />
            <label>
                Отдельный автор
            </label>
            <input
                className="border-2"
                value={author}
                onChange={e => setAuthor(e.target.value)}
            />
            <label>
                Отдельный переводчик
            </label>
            <input
                className="border-2"
                value={translator}
                onChange={e => setTranslator(e.target.value)}
            />
            <label>
                Порядковый номер
            </label>
            <input
                className="border-2"
                value={bookIndex}
                onChange={e => setBookIndex(e.target.value)}
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
                Тип
            </label>
            <select className="border-2" value={type} onChange={(event) => setType(event.target.value)}>
                {Object.values(TextKind).map(val => (
                    <option
                        key={val}
                        value={val}
                    >
                        {printTextKind(val)}
                    </option>
                ))}
            </select>
            <label>
                Стихи
            </label>
            <textarea
                className="border-2"
                value={poems}
                onChange={e => setPoems(e.target.value)}
            />
            <label>
                Сноски
            </label>
            <textarea
                className="border-2"
                value={footnotes}
                onChange={e => setFootnotes(e.target.value)}
            />
            <label>
                Содержимое
            </label>
            <textarea
                className="border-2 h-48"
                value={content}
                onChange={e => setContent(e.target.value)}
            />
        </div>
    );
};

export default AdminEditor;

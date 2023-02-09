"use client";

import {footNotesToArray, printTextKind, printTextReadiness, TextKind, TextReadiness} from "@/utils/texts";
import {useEffect, useState} from "react";

const AdminEditor = ({ value }: any) => {
    const [footnotes, setFootnotes] = useState(
        value.footnotes?.map((e: string, i: number) => `${i + 1} ${e}`).join('\n') || ""
    );
    const [name, setName] = useState(value.name || "");
    const [start, setStart] = useState(value.start || "");
    const [bookIndex, setBookIndex] = useState(value.bookIndex || 0);
    const [description, setDescription] = useState(value.description || "");
    const [type, setType] = useState(value.type || "");
    const [readiness, setReadiness] = useState(value.readiness || "");
    const [content, setContent] = useState(value.content || "");

    const [saved, setIsSaved] = useState(false);

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
                footnotes: fNotes,
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
                Порядковый номер
            </label>
            <input
                className="border-2"
                value={bookIndex}
                onChange={e => setBookIndex(e.target.value)}
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
                className="border-2"
                value={content}
                onChange={e => setContent(e.target.value)}
            />
        </div>
    );
};

export default AdminEditor;

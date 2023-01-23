"use client";

import {footNotesToArray} from "@/utils/texts";
import {useEffect, useState} from "react";

const AdminEditor = ({ value }: any) => {
    const [footnotes, setFootnotes] = useState(
        value.footnotes?.map((e: string, i: number) => `${i + 1} ${e}`).join('\n') || ""
    );
    const [name, setName] = useState(value.name || "");
    const [content, setContent] = useState(value.content || "");
    const onSubmit = () => {
        const fNotes = footNotesToArray(footnotes);
        console.log(fNotes);
        if (fNotes.includes(undefined)) {
            alert("Error with footnotes");
        }
        console.log(fNotes);
        fetch('/api/admin/texts', {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id: value.id,
                name,
                content,
                footnotes: fNotes,
            }),
        });
    };
    return (
        <div className="flex flex-col">
            <button onClick={onSubmit}>
                Готово
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

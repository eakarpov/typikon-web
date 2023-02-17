"use client";

import Link from "next/link";
import {useState} from "react";

const AdminEditor = ({ value }: any) => {
    const [name, setName] = useState(value.name || "");
    const [translator, setTranslator] = useState(value.translator || "");

    const [saved, setIsSaved] = useState(false);

    const onSubmitAdd = () => {
        fetch('/api/admin/texts', {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ bookId: value.id }),
        });
    };
    const onSubmitSave = () => {
        setIsSaved(false);
        fetch(`/api/admin/books/${value.id}`, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name,
                translator,
            }),
        }).then(() => {
            setIsSaved(true);
        });
    };
    return (
        <div className="flex flex-col">
            <p>
                Книга {value.name}
            </p>
            <button onClick={onSubmitSave}>
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
                Переводчик(и)
            </label>
            <input
                className="border-2"
                value={translator}
                onChange={e => setTranslator(e.target.value)}
            />
            <p onClick={onSubmitAdd} className="cursor-pointer">
                Добавить текст
            </p>
            {value.texts.map((text: any) => (
                <div className="flex flex-row mb-4" key={text.id}>
                    <p className="text-slate-400 w-36">
                        {text.name || "Нет названия"}
                    </p>
                    <div className="flex flex-col space-y-1 w-60">
                        <Link
                            href={`/admin/texts/${text.id}`}
                            className="cursor-pointer"
                        >
                            {text.id}
                        </Link>
                    </div>
                    <p>
                        Удалить текст (пока не работает - опасно!)
                    </p>
                </div>
            ))}
        </div>
    );
};

export default AdminEditor;

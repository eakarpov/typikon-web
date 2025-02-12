"use client";

import Link from "next/link";
import {useState} from "react";

const AdminEditor = ({ value }: any) => {
    const [name, setName] = useState(value.name || "");
    const [description, setDescription] = useState(value.description || "");
    const [author, setAuthor] = useState(value.author || "");
    const [translator, setTranslator] = useState(value.translator || "");
    const [order, setOrder] = useState(value.order || "");

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
                description,
                translator,
                order: parseInt(order),
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
                Описание
            </label>
            <input
                className="border-2"
                value={description}
                onChange={e => setDescription(e.target.value)}
            />
            <label>
                Автор(ы)
            </label>
            <input
                className="border-2"
                value={author}
                onChange={e => setAuthor(e.target.value)}
            />
            <label>
                Переводчик(и)
            </label>
            <input
                className="border-2"
                value={translator}
                onChange={e => setTranslator(e.target.value)}
            />
            <label>
                Порядок
            </label>
            <input
                className="border-2"
                value={order}
                onChange={e => setOrder(e.target.value)}
            />
            <p onClick={onSubmitAdd} className="cursor-pointer mb-2">
                <b>Добавить текст</b>
            </p>
            {value.texts.map((text: any) => (
                <div className="flex flex-row mb-4" key={text.id}>
                    <p className="w-[40%]">
                        {text.name || "Нет названия"}
                    </p>
                    <p className="text-slate-400 w-[30%]">
                        {text.description}
                    </p>
                    <div className="flex flex-col text-slate-400 space-y-1 w-[20%]">
                        <Link
                            href={`/admin/texts/${text.id}`}
                            className="cursor-pointer"
                        >
                            {text.id}
                        </Link>
                    </div>
                    <p className="text-slate-400 w-[10%]">
                        Удалить текст (?)
                    </p>
                </div>
            ))}
        </div>
    );
};

export default AdminEditor;

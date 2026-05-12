"use client";
import Link from "next/link";
import {useEffect, useState} from "react";

const AdminEditor = ({ value }: { value: any[] }) => {
    const [saved, setIsSaved] = useState(false);
    const [search, setSearch] = useState("");
    const [items, setItems] = useState<any[]>([]);
    const [emptyItems, setEmptyItems] = useState<any[]>([]);

    const onSubmitAdd = () => {
        fetch('/api/admin/nobles', {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
        });
    };

    const onUpdateStructure = () => {
        fetch('/api/admin/nobles/sync', {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
        });
    };

    useEffect(() => {
        fetch(`/api/v1/nobles?query=${search}`, {
            method: "GET",
            headers: {
                'Content-Type': 'application/json',
            },
        }).then(res => res.json())
            .then(r => setItems(r.data));
    }, [search]);

    useEffect(() => {
        fetch(`/api/admin/nobles/empty`, {
            method: "GET",
            headers: {
                'Content-Type': 'application/json',
            },
        }).then(res => res.json())
            .then(r => setEmptyItems(r.data));
    }, []);

    return (
        <div className="flex flex-col">
            <div>
                <label>Поиск</label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            <p onClick={onSubmitAdd} className="cursor-pointer">
                Добавить человека
            </p>
            {/*<p onClick={onUpdateStructure} className="cursor-pointer">*/}
            {/*    Обновить структуру*/}
            {/*</p>*/}
            {items?.map((text: any) => (
                <div className="flex flex-row mb-4" key={text.id}>
                    <div className="flex flex-col space-y-1 w-60">
                        <Link
                            href={`/admin/nobles/${text.id}`}
                            className="cursor-pointer"
                        >
                            {text.name || "Нет названия"}
                        </Link>
                    </div>
                    <p>
                        Удалить место (пока не работает - опасно!)
                    </p>
                </div>
            ))}
            <div>
                Пустые
            </div>
            {emptyItems?.map((text: any) => (
                <div className="flex flex-row mb-4" key={text.id}>
                    <div className="flex flex-col space-y-1 w-60">
                        <Link
                            href={`/admin/nobles/${text.id}`}
                            className="cursor-pointer"
                        >
                            {text.name || "Нет названия"}
                        </Link>
                    </div>
                    <p>
                        Удалить место (пока не работает - опасно!)
                    </p>
                </div>
            ))}
        </div>
    );
};

export default AdminEditor;

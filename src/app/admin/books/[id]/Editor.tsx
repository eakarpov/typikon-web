"use client";

import Link from "next/link";

const AdminEditor = ({ value }: any) => {
    const onSubmit = () => {
        fetch('/api/admin/texts', {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ bookId: value.id }),
        });
    };
    console.log(value);
    return (
        <div className="flex flex-col">
            <p>
                Книга {value.name}
            </p>
            <p onClick={onSubmit} className="cursor-pointer">
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

"use client";
import Link from "next/link";
import {useState} from "react";

const AdminEditor = ({ value }: { value: any[] }) => {
    const [saved, setIsSaved] = useState(false);

    const onSubmitAdd = () => {
        fetch('/api/admin/signs', {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
        });
    };

    return (
        <div className="flex flex-col">
            <p onClick={onSubmitAdd} className="cursor-pointer">
                Добавить святого
            </p>
            {value?.map((text: any) => (
                <div className="flex flex-row mb-4" key={text._id}>
                    <p className="text-slate-400 w-36">
                        {text.name || "Нет названия"}
                    </p>
                    <p className="text-slate-400 w-36">
                        {text.description}
                    </p>
                    <div className="flex flex-col space-y-1 w-60">
                        <Link
                            href={`/admin/signs/${text._id}`}
                            className="cursor-pointer"
                        >
                            {text._id}
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

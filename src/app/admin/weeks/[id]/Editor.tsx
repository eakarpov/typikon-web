"use client";

import Link from "next/link";
import {useState} from "react";

const AdminEditor = ({ value }: any) => {
    const [alias, setAlias] = useState(value.alias || "");
    const onSubmitAdd = () => {
        fetch('/api/admin/days', {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ weekId: value.id }),
        });
    };
    const onSubmitSave = () => {
        console.log(alias);
        fetch(`/api/admin/weeks/${value.id}`, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                alias,
            }),
        });
    };
    return (
        <div className="flex flex-col">
            <p>
                Неделя {value.value} по {value.type === 'Pascha' ? "Пасхе" : "Пятидесятнице"}
            </p>
            <button onClick={onSubmitSave}>
                Готово
            </button>
            <label>
                Алиас
            </label>
            <input
                className="border-2"
                value={alias}
                onChange={e => setAlias(e.target.value)}
            />
            <p onClick={onSubmitAdd} className="cursor-pointer">
                Добавить день
            </p>
            {value.days.map((day: any) => (
                <div className="flex flex-row mb-4" key={day.id}>
                    <p className="text-slate-400 w-36">
                        {day.name || "Нет названия"}
                    </p>
                    <div className="flex flex-col space-y-1 w-60">
                        <Link
                            href={`/admin/days/${day.id}`}
                            className="cursor-pointer"
                        >
                            {day.id} {day.alias && `(${day.alias})`}
                        </Link>
                    </div>
                    <p>
                        Удалить день (пока не работает - опасно!)
                    </p>
                </div>
            ))}
        </div>
    );
};

export default AdminEditor;

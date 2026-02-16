"use client";
import {useCallback, useEffect, useState} from "react";

const signs = [
    { id: "compline", name: "Повечерие" },
    { id: "hallelujah", name: "Аллилуия" },
    { id: "no", name: "Без знака" },
    { id: "sixth", name: "Шестеричная" },
    { id: "doxology", name: "Славословие" },
    { id: "polyeleos", name: "Полиелей" },
    { id: "vigil", name: "Бдение" },
    { id: "great-vigil", name: "Бдение (великий праздник)" },
    { id: "great-feast", name: "Двунадесятый праздник" },
];

const sources = [
    { id: "typikon", name: "Типикон" },
    { id: "eye", name: "Церковное око"},
]

const AdminEditor = ({ value }: any) => {
    const [name, setName] = useState(value.name || "");
    const [date, setDate] = useState(value.date || 0);
    const [month, setMonth] = useState(value.month || 0);
    const [sign, setSign] = useState(value.sign || "");
    const [source, setSource] = useState(value.source || "");

    const [saved, setIsSaved] = useState(false);

    const onSubmit = () => {
        setIsSaved(false);
        fetch(`/api/admin/signs/${value.id}`, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name,
                month: parseInt(month),
                date: parseInt(date),
                sign,
                source,
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
                Месяц памяти
            </label>
            <input
                className="border-2"
                value={month}
                onChange={e => setMonth(e.target.value)}
            />
            <label>
                Число в месяце памяти
            </label>
            <input
                className="border-2"
                value={date}
                onChange={e => setDate(e.target.value)}
            />
            <label>
                Знак
            </label>
            <select>
                {signs.map((s) => (
                    <option
                        key={s.id}
                        value={s.id}
                        selected={s.id === sign}
                    >
                        {s.name}
                    </option>
                ))}
            </select>
            <label>
                Источник
            </label>
            <select>
                {sources.map((s) => (
                    <option
                        key={s.id}
                        value={s.id}
                        selected={s.id === source}
                    >
                        {s.name}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default AdminEditor;

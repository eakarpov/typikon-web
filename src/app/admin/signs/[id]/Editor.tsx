"use client";
import {useState} from "react";
import {SIGN} from "@/types/dto/days";

const signs = [
    { id: SIGN.NO_SIGN, name: "Без знака" },
    { id: SIGN.HALLELUJAH, name: "Аллилуйная" },
    { id: SIGN.SIX_STICHERA, name: "Шестеричная" },
    { id: SIGN.DOXOLOGIC, name: "Славословная" },
    { id: SIGN.POLYELEOS, name: "Полиелейная" },
    { id: SIGN.VIGIL, name: "Бденная" },
    { id: SIGN.GREAT_VIGIL, name: "Бдение (двунадесятый праздник)" },
];

const sources = [
    { id: "typikon", name: "Типикон" },
    { id: "eye", name: "Церковное око"},
]

const AdminEditor = ({ value }: any) => {
    const [name, setName] = useState(value.name || "");
    const [date, setDate] = useState(value.date || 0);
    const [month, setMonth] = useState(value.month || 0);
    const [sign, setSign] = useState(value.sign || SIGN.NO_SIGN);
    const [source, setSource] = useState(value.source || "");
    const [isDefault, setIsDefault] = useState(!!value.isDefault);
    const [signConditional, setSignConditional] = useState(!!value.signConditional);
    const [order, setOrder] = useState(value.order || 0);
    const [needsReview, setNeedsReview] = useState(!!value.needsReview);
    const [sourceUrl, setSourceUrl] = useState(value.sourceUrl || "");

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
                isDefault,
                signConditional,
                order: parseInt(order),
                needsReview,
                sourceUrl,
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
                Позиция среди памятей дня
            </label>
            <input
                type="number"
                className="border-2"
                value={order}
                onChange={e => setOrder(e.target.value)}
            />
            <label>
                Знак
            </label>
            <select
                className="border-2"
                value={sign}
                onChange={e => setSign(e.target.value as SIGN)}
            >
                {signs.map((s) => (
                    <option
                        key={s.id}
                        value={s.id}
                    >
                        {s.name}
                    </option>
                ))}
            </select>
            <label>
                <input
                    type="checkbox"
                    checked={signConditional}
                    onChange={e => setSignConditional(e.target.checked)}
                />
                {" "}Знак условный (зависит от Пасхалии)
            </label>
            <label>
                Источник
            </label>
            <select
                className="border-2"
                value={source}
                onChange={e => setSource(e.target.value)}
            >
                {sources.map((s) => (
                    <option
                        key={s.id}
                        value={s.id}
                    >
                        {s.name}
                    </option>
                ))}
            </select>
            <label>
                Ссылка на источник
            </label>
            <input
                className="border-2"
                value={sourceUrl}
                onChange={e => setSourceUrl(e.target.value)}
            />
            <label>
                <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={e => setIsDefault(e.target.checked)}
                />
                {" "}Основная память дня (маркер дефолтности)
            </label>
            <label>
                <input
                    type="checkbox"
                    checked={needsReview}
                    onChange={e => setNeedsReview(e.target.checked)}
                />
                {" "}Требует проверки
            </label>
        </div>
    );
};

export default AdminEditor;

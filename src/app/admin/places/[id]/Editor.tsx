"use client";
import {
    DneslovKind,
    footNotesToArray,
    printDneslovKind,
    printTextKind,
    printTextReadiness,
    TextKind,
    TextReadiness
} from "@/utils/texts";
import {useCallback, useEffect, useState} from "react";

const AdminEditor = ({ value }: any) => {
    const [footnotes, setFootnotes] = useState(
        value.footnotes?.map((e: string, i: number) => `${i + 1} ${e}`).join('\n') || ""
    );
    const [name, setName] = useState(value.name || "");
    const [synonyms, setSynonyms] = useState(value.synonyms || []);
    const [links, setLinks] = useState(value.links || []);
    const [latitude, setLatitude] = useState(value.latitude || "");
    const [longitude, setLongitude] = useState(value.longitude || "");
    const [description, setDescription] = useState(value.description || "");
    const [alias, setAlias] = useState(value.alias || "");

    const [saved, setIsSaved] = useState(false);

    const onBufferClick = useCallback(() => {
        navigator.clipboard.writeText(`https://typikon.su/reading/${alias}`);
    }, [alias]);

    const onSubmit = () => {
        setIsSaved(false);
        fetch(`/api/admin/places/${value.id}`, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name,
                links,
                latitude,
                longitude,
                description,
                alias,
                synonyms,
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
                Алиас записи
            </label>
            <input
                className="border-2"
                value={alias}
                onChange={e => setAlias(e.target.value)}
            />
            <div
                className="cursor-pointer"
                onClick={onBufferClick}
            >
                Скопировать в буфер полный адрес
            </div>
            <label>
                Описание
            </label>
            <input
                className="border-2"
                value={description}
                onChange={e => setDescription(e.target.value)}
            />
            <label>
                Синонимы <span
                className="cursor-pointer"
                onClick={() => {
                    setSynonyms([...synonyms, ""]);
                }}
            >Добавить</span>
            </label>
            {synonyms.map((sName: string, index: number) => (
                <div key={sName}>
                    <input
                        className="border-2"
                        value={sName}
                        onChange={e => {
                            const sNames = [...synonyms];
                            sNames[index] = e.target.value;
                            setSynonyms(sNames);
                        }}
                    />
                    <span
                        onClick={() => {
                            const sNames = [...synonyms];
                            sNames.splice(index, 1);
                            setSynonyms(sNames)
                        }}
                    >
                        Удалить
                    </span>
                </div>
            ))}
            <label>
                Широта
            </label>
            <input
                className="border-2"
                value={latitude}
                onChange={e => setLatitude(e.target.value)}
            />
            <label>
                Долгота
            </label>
            <input
                className="border-2"
                value={longitude}
                onChange={e => setLongitude(e.target.value)}
            />
            <label>
                Ссылки <span
                className="cursor-pointer"
                onClick={() => {
                    setLinks([...links, { url: "", text: "" }]);
                }}
            >Добавить</span>
            </label>
            {links.map((link: { url: string; text: string;}, index: number) => (
                <div key={link.url}>
                    <label>
                        Ссылка
                    </label>
                    <input
                        className="border-2"
                        value={link.url}
                        onChange={e => {
                            const sNames = [...links];
                            sNames[index].url = e.target.value;
                            setLinks(sNames);
                        }}
                    />
                    <label>
                        Текст
                    </label>
                    <input
                        className="border-2"
                        value={link.text}
                        onChange={e => {
                            const sNames = [...links];
                            sNames[index].text = e.target.value;
                            setLinks(sNames);
                        }}
                    />
                    <span
                        onClick={() => {
                            const sNames = [...links];
                            sNames.splice(index, 1);
                            setLinks(sNames)
                        }}
                    >
                        Удалить
                    </span>
                </div>
            ))}
        </div>
    );
};

export default AdminEditor;

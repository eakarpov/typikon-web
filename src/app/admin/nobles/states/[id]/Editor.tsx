'use client';
import React, {useState} from "react";
import StateItem from "@/app/admin/nobles/[id]/StateItem";

const AdminEditor = ({ value }: any) => {
    const [name, setName] = useState(value.name || "");
    const [surnames, setSurnames] = useState(value.surnames || "");
    const [title, setTitle] = useState(value.defaultTitle || "");
    const [predessorId, setPredessorId] = useState(value.predessorId || "");

    const [saved, setSaved] = useState<boolean>(false);

    const onSubmit = () => {
        setSaved(false);
        fetch(`/api/admin/nobles/states/${value.id}`, {
            method: "POST",
            body: JSON.stringify({
                name,
                surnames,
                title,
                predessorId,
            }),
        }).then(() => {
            setSaved(true);
        });
    };

    return (
        <div id="text-editor" className="flex flex-col">
            <button onClick={onSubmit}>
                {saved ? "Сохранено!" : "Сохранить"}
            </button>
            <div className="flex flex-row pr-4">
                <div className="flex flex-col pr-4">
                    <label>
                        Название державности
                    </label>
                    <input
                        className="border-2"
                        value={name}
                        onChange={e => setName(e.target.value)}
                    />
                </div>
                <div className="flex flex-col pr-4">
                    <label>
                        Титул правителя
                    </label>
                    <input
                        className="border-2"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                    />
                </div>
            </div>
            <div className="flex flex-row pr-4">
                <div className="flex flex-col pr-4">
                    <label>
                        Другие наименования
                    </label>
                    <textarea
                        className="border-2"
                        value={surnames}
                        onChange={e => setSurnames(e.target.value)}
                    />
                </div>
                <StateItem
                    value={predessorId}
                    setValue={setPredessorId}
                    placeholder="Державность-предшественник"
                />
            </div>
        </div>
    );
}

export default AdminEditor;

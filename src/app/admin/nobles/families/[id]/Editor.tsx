'use client';
import React, {useState} from "react";

const AdminEditor = ({ value }: any) => {
    const [name, setName] = useState(value.name || "");

    const [saved, setSaved] = useState<boolean>(false);

    const onSubmit = () => {
        setSaved(false);
        fetch(`/api/admin/nobles/families/${value.id}`, {
            method: "POST",
            body: JSON.stringify({
                name,

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
                        Название рода
                    </label>
                    <input
                        className="border-2"
                        value={name}
                        onChange={e => setName(e.target.value)}
                    />
                </div>
            </div>
        </div>
    );
}

export default AdminEditor;

'use client';
import React, {ChangeEventHandler, useCallback, useState} from "react";

const SettingsPage = (data: any) => {
    const [value, setValue] = useState(localStorage.getItem("typikon-background-color") || "#fcfaf2");

    const onColorChange: ChangeEventHandler<HTMLInputElement> = useCallback((e) => {
        setValue(e.target.value);
        localStorage.setItem("typikon-background-color", e.target.value);
        document.body.style.background = e.target.value;
    }, []);

    return (
        <div>
            <h2>Настройки пользователя</h2>
            <div>
                Цвет фона: <input type="color" value={value} onChange={onColorChange} />
            </div>
        </div>
    )
};

export default SettingsPage;

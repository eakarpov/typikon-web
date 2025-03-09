'use client';
import React, {ChangeEventHandler, useCallback, useEffect, useState} from "react";

const ChooseFontPicker = () => {
    const [value, setValue] = useState(
        "black"
    );

    const onColorChange: ChangeEventHandler<HTMLInputElement> = useCallback((e) => {
        setValue(e.target.value);
        localStorage.setItem("typikon-font-color", e.target.value);
        document.body.style.color = e.target.value;
    }, []);

    useEffect(() => {
        setValue(old => localStorage.getItem("typikon-font-color") || old);
    }, []);

    return (
        <div>
            <div>
                Цвет шрифта (вместо черного): <input type="color" value={value} onChange={onColorChange} />
            </div>
        </div>
    )
};

export default ChooseFontPicker;

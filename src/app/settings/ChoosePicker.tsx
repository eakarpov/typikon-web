'use client';
import React, {ChangeEventHandler, useCallback, useEffect, useState} from "react";

const ChoosePicker = () => {
    const [value, setValue] = useState(
        "#fcfaf2"
    );

    const onColorChange: ChangeEventHandler<HTMLInputElement> = useCallback((e) => {
        setValue(e.target.value);
        localStorage.setItem("typikon-background-color", e.target.value);
        document.body.style.background = e.target.value;
    }, []);

    useEffect(() => {
        setValue(old => localStorage.getItem("typikon-background-color") || old);
    }, []);

    return (
        <div>
            <div>
                Цвет фона: <input type="color" value={value} onChange={onColorChange} />
            </div>
        </div>
    )
};

export default ChoosePicker;

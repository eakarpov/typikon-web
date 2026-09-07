"use client";

import React, {useCallback, useState} from "react";

const Form = () => {
    const [value, setValue] = useState("");

    const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value), []);

    const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.keyCode === 13) {
            //
        }
    }, []);

    return (
        <>
            <label className="font-serif">
                Поиск:
            </label>
            <input
                value={value}
                onChange={onChange}
                onKeyDown={onKeyDown}
                className="search-input"
            />
        </>
    )
}
'use client';
import React, {ChangeEventHandler, KeyboardEventHandler, memo, useCallback, useState} from "react";
import "./styles.scss";
import {useRouter, useSearchParams} from 'next/navigation'

const SearchForm = () => {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [value, setValue] = useState(searchParams.get("query") || "");

    const onChange: ChangeEventHandler<HTMLInputElement> = useCallback((e) => {
        setValue(e.target.value);
    }, []);

    const onKeyDown: KeyboardEventHandler<HTMLInputElement> = useCallback((e) => {
        if (e.keyCode === 13) {
            router.push(`/search?query=${value}`);
        }
    }, [value]);

    return (
        <>
            <label>
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
};

export default memo(SearchForm);

'use client';
import React, {ChangeEventHandler, KeyboardEventHandler, memo, useCallback, useState} from "react";
import "./styles.scss";
import {useRouter, useSearchParams} from 'next/navigation'
import Link from "next/link";

const SearchForm = ({ initial = []}: {initial: any[]}) => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [items, setItems] = useState(initial)

    const [value, setValue] = useState(searchParams.get("query") || "");

    const onChange: ChangeEventHandler<HTMLInputElement> = useCallback((e) => {
        setValue(e.target.value);
    }, []);

    const onKeyDown: KeyboardEventHandler<HTMLInputElement> = useCallback((e) => {
        if (e.keyCode === 13) {
            // router.push(`/search?query=${value}`);
            fetch(`/api/v1/search?query=${value}`).then((res) => res.json()).then((newItems) => {
                if (Array.isArray(newItems)) {
                    setItems(newItems);
                }
            });
        }
    }, [value]);

    return (
        <>
            <span>
                Для поиска используйте только кириллические буквы А-Я/а-я<br/>
            </span>
            <label>
                Поиск:
            </label>
            <input
                value={value}
                onChange={onChange}
                onKeyDown={onKeyDown}
                className="search-input"
            />
            {items.map(item => (
                <div key={item.id}>
                    <Link href={`/reading/${item.id}`}>
                        {item.name}
                    </Link>
                </div>
            ))}
        </>
    )
};

export default memo(SearchForm);

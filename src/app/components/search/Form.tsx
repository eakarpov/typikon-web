'use client';
import React, {ChangeEventHandler, KeyboardEventHandler, memo, useCallback, useState} from "react";
import "./styles.scss";
import {usePathname, useRouter, useSearchParams} from 'next/navigation'
import Link from "next/link";

const SearchForm = ({ initial = []}: {initial?: any[]}) => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const [items, setItems] = useState(initial)

    const [value, setValue] = useState(searchParams?.get("query") || "");

    const onChange: ChangeEventHandler<HTMLInputElement> = useCallback((e) => {
        setValue(e.target.value);
    }, []);

    const onKeyDown: KeyboardEventHandler<HTMLInputElement> = useCallback((e) => {
        if (e.keyCode === 13) {
            if (pathname === "/") {
                router.push(`/search?query=${value}`);
            } else {
                fetch(`/api/v1/search?query=${value}`).then((res) => res.json()).then((newItems) => {
                    if (Array.isArray(newItems)) {
                        setItems(newItems);
                    }
                });
            }
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

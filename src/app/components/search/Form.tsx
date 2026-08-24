'use client';
import React, {ChangeEventHandler, KeyboardEventHandler, memo, useCallback, useEffect, useState} from "react";
import "./styles.scss";
import {usePathname, useRouter, useSearchParams} from 'next/navigation'
import Link from "next/link";

const SearchForm = ({ initial = []}: {initial?: any[]}) => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const [items, setItems] = useState(initial)

    // Публичный API второй версии: список приходит в конверте {items, total, ...},
    // поля те же, что отдаёт серверный поиск, — включая snippet.
    const loadResults = useCallback((query: string) => {
        fetch(`/api/v2/search?q=${encodeURIComponent(query)}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (Array.isArray(data?.items)) setItems(data.items);
            })
            .catch(() => {
                // Пустая выдача лучше, чем оборванная страница.
            });
    }, []);

    const [value, setValue] = useState(searchParams?.get("query") || "");

    const onChange: ChangeEventHandler<HTMLInputElement> = useCallback((e) => {
        setValue(e.target.value);
    }, []);

    const onKeyDown: KeyboardEventHandler<HTMLInputElement> = useCallback((e) => {
        if (e.keyCode === 13) {
            if (pathname === "/") {
                router.push(`/search?query=${value}`);
            } else {
                router.replace(`/search?query=${value}`);
                loadResults(value);
            }
        }
    }, [value]);

    useEffect(() => {
        const val = searchParams?.get("query");
        if (val) {
            loadResults(val);
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
            {items.map(item => (
                <div key={item.id} className="mb-2">
                    {/* Ссылка по alias, если он есть: страница чтения иначе сама
                        перенаправит с ObjectId на alias — лишний переход. */}
                    <Link href={`/reading/${item.alias || item.id}`} className="font-serif">
                        {item.name}
                    </Link>
                    {item.snippet && (
                        <p className="font-serif text-sm text-slate-600">
                            {item.snippet}
                        </p>
                    )}
                </div>
            ))}
        </>
    )
};

export default memo(SearchForm);

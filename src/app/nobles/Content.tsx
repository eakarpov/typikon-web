"use client";
import Link from "next/link";
import {useCallback, useEffect, useState} from "react";

const Content = ({ }: { }) => {
    const [search, setSearch] = useState("");
    const [items, setItems] = useState<any[]>([]);

    useEffect(() => {
        fetch('/api/v1/nobles', {
            method: "GET",
            headers: {
                'Content-Type': 'application/json',
            },
        }).then(res => res.json())
            .then(res => setItems(res.data));
    }, []);

    const onSearch = useCallback(() => {
        fetch(`/api/v1/nobles?query=${search}`, {
            method: "GET",
            headers: {
                'Content-Type': 'application/json',
            },
        }).then(res => res.json())
            .then(res => setItems(res.data));
    }, [search]);

    return (
        <div className="flex flex-col">
            <div className="font-serif">
                <label>Поиск</label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button onClick={onSearch}>Найти</button>
            </div>
            {items?.map((text: any) => (
                <div className="flex flex-row mb-4" key={text.id}>
                    <div className="flex flex-col space-y-1 w-60">
                        <Link
                            href={`/nobles/${text.id}`}
                            className="cursor-pointer font-serif"
                        >
                            {text.name}
                        </Link>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default Content;

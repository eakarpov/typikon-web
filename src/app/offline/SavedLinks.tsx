'use client';
import React, {useEffect, useState} from "react";
import Link from "next/link";
import {isSupported, listSaved, SavedPage} from "@/lib/offline";

// То, что человек отложил сам, — прямо здесь, на странице «нет сети». Иначе он
// знает, что сохранённое где-то есть, но добраться до него без интернета может
// только по памяти адреса.

const SavedLinks = () => {
    const [pages, setPages] = useState<SavedPage[]>([]);

    useEffect(() => {
        if (!isSupported()) return;

        let alive = true;
        listSaved().then((answer) => {
            if (!alive || !answer.ok) return;
            setPages([...answer.saved].sort((a, b) => b.savedAt - a.savedAt));
        });

        return () => { alive = false; };
    }, []);

    if (!pages.length) return null;

    return (
        <div className="flex flex-col gap-1 pt-2">
            <p className="font-serif">Отложено для чтения без интернета:</p>
            <ul className="flex flex-col gap-1">
                {pages.map((page) => (
                    <li key={page.url}>
                        <Link
                            href={page.url}
                            className="font-serif text-amber-800 underline underline-offset-4"
                        >
                            {page.label}
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default SavedLinks;

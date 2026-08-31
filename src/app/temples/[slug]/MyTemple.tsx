'use client';
import { useCallback, useEffect, useState } from "react";

// «Это мой храм». Хранится в браузере, как настройки чтения
// (@/app/settings/ReadingSettings): выбор храма — не тайна и не повод
// требовать вход. На сервере его нет, поэтому первый показ — без отметки,
// а прочитанное подставляется после монтирования.

export const MY_TEMPLE_KEY = "typikon:my-temple";

export interface MyTempleValue { slug: string; name: string }

export const readMyTemple = (): MyTempleValue | null => {
    try {
        const raw = window.localStorage.getItem(MY_TEMPLE_KEY);
        return raw ? JSON.parse(raw) as MyTempleValue : null;
    } catch {
        // Приватный режим и запрет хранилища — не повод ронять страницу.
        return null;
    }
};

const MyTemple = ({ slug, name }: MyTempleValue) => {
    const [mine, setMine] = useState<MyTempleValue | null>(null);

    useEffect(() => { setMine(readMyTemple()); }, []);

    const choose = useCallback(() => {
        const value = { slug, name };
        try { window.localStorage.setItem(MY_TEMPLE_KEY, JSON.stringify(value)); } catch { /* см. выше */ }
        setMine(value);
    }, [slug, name]);

    const forget = useCallback(() => {
        try { window.localStorage.removeItem(MY_TEMPLE_KEY); } catch { /* см. выше */ }
        setMine(null);
    }, []);

    const isMine = mine?.slug === slug;

    return (
        <div className="font-serif mt-4">
            {isMine ? (
                <span className="text-slate-600">
                    Это ваш храм.{" "}
                    <button type="button" onClick={forget} className="text-amber-800 hover:underline">
                        забыть
                    </button>
                </span>
            ) : (
                <button
                    type="button"
                    onClick={choose}
                    className="border border-amber-800 text-amber-800 rounded px-3 py-1 hover:bg-amber-50"
                >
                    Это мой храм
                </button>
            )}
            {mine && !isMine && (
                <span className="text-sm text-slate-500 ml-2">сейчас выбран: {mine.name}</span>
            )}
        </div>
    );
};

export default MyTemple;

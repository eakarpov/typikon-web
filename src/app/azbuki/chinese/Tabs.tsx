'use client';
import { useEffect, useState } from "react";
import Reference from "./Reference";
import Character from "./Character";
import TextTab from "./TextTab";
import type { TabId } from "@/lib/azbuki/chinese/types";

// Три вкладки. Выбранная живёт в хеше адреса, чтобы на разбор конкретного
// раздела можно было дать ссылку и чтобы «назад» возвращало туда, где были.
//
// Вкладки не размонтируются переключением: у разбора иероглифа и у текста
// введённое сохраняется, а данные (до 6,8 МБ) не перезапрашиваются.

const TABS: [TabId, string][] = [
    ["reference", "Справочник"],
    ["character", "Иероглиф"],
    ["text", "Текст"],
];

const Tabs = () => {
    const [tab, setTab] = useState<TabId>("reference");
    const [seen, setSeen] = useState<Set<TabId>>(new Set(["reference"]));

    useEffect(() => {
        const fromHash = () => {
            const h = window.location.hash.replace("#", "") as TabId;
            if (TABS.some(([id]) => id === h)) {
                setTab(h);
                setSeen(s => (s.has(h) ? s : new Set(s).add(h)));
            }
        };
        fromHash();
        window.addEventListener("hashchange", fromHash);
        return () => window.removeEventListener("hashchange", fromHash);
    }, []);

    const go = (id: TabId) => {
        setTab(id);
        setSeen(s => (s.has(id) ? s : new Set(s).add(id)));
        window.history.replaceState(null, "", `#${id}`);
    };

    return (
        <div className="flex flex-col gap-4">
            <nav className="flex gap-4 border-b border-slate-200 pb-1" aria-label="Разделы азбуки">
                {TABS.map(([id, title]) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => go(id)}
                        aria-current={tab === id ? "page" : undefined}
                        className={`font-serif pb-1 -mb-1 border-b-2 ${
                            tab === id
                                ? "border-amber-800 text-amber-900 font-bold"
                                : "border-transparent text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        {title}
                    </button>
                ))}
            </nav>

            {/* Отрисованные вкладки прячем, а не размонтируем: иначе при
                возврате заново качались бы мегабайты и терялся ввод. */}
            {TABS.map(([id]) => (
                seen.has(id) ? (
                    <div key={id} hidden={tab !== id}>
                        {id === "reference" && <Reference />}
                        {id === "character" && <Character />}
                        {id === "text" && <TextTab />}
                    </div>
                ) : null
            ))}
        </div>
    );
};

export default Tabs;

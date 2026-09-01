'use client';
import React, {memo, useCallback, useEffect, useState} from "react";
import {ArrowPathIcon, CheckCircleIcon, CloudArrowDownIcon} from "@heroicons/react/24/outline";
import {currentPageUrl, forgetPage, isSupported, listSaved, savePage} from "@/lib/offline";

// Кнопка «читать без сети» рядом с прочими действиями над чтением.
//
// Кэш страниц набирается и сам, но молча и с обрезкой по сотне записей: рассчитывать
// на него, уезжая в дорогу, нельзя. Здесь человек говорит прямо, что́ ему понадобится
// без интернета, — и это остаётся, пока он сам не уберёт.
//
// В разработке воркер не регистрируется (см. ServiceWorkerRegistrar), поэтому
// кнопка там не появляется вовсе. Проверять — на сборке: npm run build && npm start.

type State = "unknown" | "idle" | "saved" | "busy";

const OfflineSave = ({ label }: { label: string }) => {
    const [state, setState] = useState<State>("unknown");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isSupported()) return;

        let alive = true;
        const url = currentPageUrl();

        listSaved().then((answer) => {
            if (!alive) return;
            if (!answer.ok) return;
            setState(answer.saved.some((page) => page.url === url) ? "saved" : "idle");
        });

        return () => { alive = false; };
    }, []);

    const onClick = useCallback(async () => {
        const url = currentPageUrl();
        const wasSaved = state === "saved";

        setState("busy");
        setError(null);

        const answer = wasSaved ? await forgetPage(url) : await savePage(url, label);

        if (!answer.ok) {
            setError(answer.error);
            setState(wasSaved ? "saved" : "idle");
            return;
        }

        setState(answer.saved.some((page) => page.url === url) ? "saved" : "idle");
    }, [label, state]);

    if (state === "unknown") return null;

    return (
        <span className="pr-4 text-amber-800 flex flex-row items-center">
            <button
                type="button"
                onClick={onClick}
                disabled={state === "busy"}
                title={state === "saved"
                    ? "Убрать из сохранённого"
                    : "Оставить эту страницу доступной без интернета"}
                className="flex flex-row items-center cursor-pointer disabled:cursor-wait"
            >
                {state === "busy" && (
                    <>
                        Сохраняю&nbsp;
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    </>
                )}
                {state === "saved" && (
                    <>
                        Есть без сети&nbsp;
                        <CheckCircleIcon className="w-4 h-4" />
                    </>
                )}
                {state === "idle" && (
                    <>
                        Читать без сети&nbsp;
                        <CloudArrowDownIcon className="w-4 h-4" />
                    </>
                )}
            </button>
            {error && (
                <span className="pl-2 font-serif text-sm text-red-600">
                    Не сохранилось: {error}
                </span>
            )}
        </span>
    );
};

export default memo(OfflineSave);

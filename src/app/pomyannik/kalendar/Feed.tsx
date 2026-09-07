'use client';
import React from "react";
import { SITE_URL } from "@/utils/site";

// ПОДПИСКА НА ЛИЧНУЮ ЛЕНТУ.
//
// Напоминание нужно накануне, а не тогда, когда человек зайдёт на сайт. Ленту
// читает тот календарь, которым он уже пользуется, — ни приложения, ни почты
// для этого не нужно.
//
// АДРЕС — ЭТО КЛЮЧ, и сказать об этом надо прямо, рядом со ссылкой: у кого он
// есть, тот видит помянник. Оттого здесь же и смена адреса, и запрет писать
// имена в календарь — тот висит на экране блокировки и синхронизируется с
// чужими службами.

const BUTTON = "border rounded px-3 py-1 bg-slate-50 hover:bg-slate-100 font-serif text-sm";

interface FeedState { token: string; withNames: boolean; lastUsedAt?: string | null }

const Feed = ({ initial }: { initial: FeedState | null }) => {
    const [feed, setFeed] = React.useState(initial);
    const [busy, setBusy] = React.useState(false);
    const [copied, setCopied] = React.useState(false);

    const url = feed
        ? `${typeof window === "undefined" ? SITE_URL : window.location.origin}`
          + `/pomyannik/feed/${feed.token}/pomyannik.ics`
        : "";

    const call = async (body: Record<string, unknown>) => {
        setBusy(true);
        setCopied(false);
        try {
            const response = await fetch("/api/pomyannik/feed", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (response.ok) setFeed(await response.json());
        } finally {
            setBusy(false);
        }
    };

    if (!feed) {
        return (
            <div className="flex flex-col gap-2">
                <p className="font-serif text-sm text-slate-800">
                    Именины, годовщины и поминальные дни можно получать в свой календарь —
                    в тот, которым вы уже пользуетесь.
                </p>
                <div>
                    <button className={BUTTON} onClick={() => call({})} disabled={busy}>
                        завести ленту
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
                <span className="font-serif text-sm text-slate-600">адрес ленты</span>
                <div className="flex flex-wrap gap-2 items-center">
                    <input readOnly value={url} onFocus={e => e.currentTarget.select()}
                           className="border rounded px-2 py-1 font-serif bg-white text-xs
                                      flex-1 min-w-0 text-slate-700" />
                    <button className={BUTTON} type="button"
                            onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); }}>
                        {copied ? "скопировано" : "скопировать"}
                    </button>
                </div>
            </div>

            <p className="font-serif text-sm text-amber-700">
                <strong>Этот адрес — ключ.</strong> У кого он есть, тот видит ваш помянник, не
                входя на сайт. Не выкладывайте его на общий доступ; если он ушёл не туда —
                смените, прежний перестанет работать сразу.
            </p>

            <label className="flex gap-2 items-start font-serif text-sm">
                <input type="checkbox" checked={!feed.withNames} className="mt-1"
                       onChange={e => call({ withNames: !e.target.checked })} disabled={busy} />
                <span>
                    не писать имена в календарь
                    <span className="block text-slate-500 text-xs">
                        вместо «Годовщина преставления: Мария» будет просто «Годовщина
                        преставления» — календарь виден и на запертом экране
                    </span>
                </span>
            </label>

            <div className="flex gap-3 items-center">
                <button className={BUTTON} onClick={() => {
                    if (window.confirm("Сменить адрес? Прежняя подписка перестанет работать.")) {
                        call({ reset: true });
                    }
                }} disabled={busy}>
                    сменить адрес
                </button>
                {feed.lastUsedAt && (
                    <span className="font-serif text-xs text-slate-400">
                        ленту читали {new Date(feed.lastUsedAt).toLocaleDateString("ru-RU")}
                    </span>
                )}
            </div>
        </div>
    );
};

export default Feed;

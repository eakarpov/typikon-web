'use client';
import React, {memo, useCallback, useEffect, useState} from "react";
import Link from "next/link";
import GoogleSignIn from "@/app/components/auth/GoogleSignIn";
import TelegramLoginWidget from "@/app/components/auth/TelegramLoginWidget";
import {reportClientError} from "@/lib/reportClientError";

/**
 * Входы учётной записи: какие привязаны и как привязать ещё.
 *
 * Появилось с закрытием ВК. Прежде привязка была следствием первого входа и
 * никак иначе не менялась — у кого ВК был единственным, тот вместе с ним терял
 * и помянник, и заметки. Теперь второй вход присоединяется к записи ИЗ-ПОД УЖЕ
 * ОТКРЫТОЙ СЕССИИ: человек сперва доказал, что запись его, и лишь потом
 * присоединяет к ней новый способ входа.
 */

const MESSAGES: Record<string, string> = {
    "linked": "Привязано.",
    "already-yours": "Этот вход у вас уже был привязан.",
    "taken": "Этот вход принадлежит другой записи на сайте. Войдите ею — или напишите через обратную связь, если записи нужно свести.",
    "occupied": "У вас уже привязан другой аккаунт этого сервиса. Сначала снимите прежний.",
    "absent": "Такой привязки нет.",
    "last": "Это ваш последний рабочий вход. Снять его нельзя: в запись стало бы не попасть.",
    "rejected": "Сервис не подтвердил, что это вы. Попробуйте ещё раз.",
    "unlinked": "Снято.",
    "no-user": "Вход кончился. Войдите заново и повторите.",
    "nosession": "Вход кончился, пока вы ходили к Яндексу. Войдите заново и повторите.",
    "denied": "Яндекс не дал разрешения — привязка не состоялась.",
    "state": "Не совпала проверочная строка. Попробуйте ещё раз.",
    "exchange": "Яндекс не подтвердил привязку. Попробуйте ещё раз.",
    "info": "Яндекс не сказал, кто вошёл. Попробуйте ещё раз.",
    "off": "Привязка Яндекса сейчас выключена.",
    "error": "Не вышло. Попробуйте позже.",
    "network": "Нет связи с сайтом.",
};

const ROW = "flex flex-col gap-1 border-t border-slate-200 pt-2";
const LABEL = "font-serif text-sm";
const BUTTON = "font-serif border rounded border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50 self-start";

const Logins = ({
    auth,
    googleApp,
    googleAppLegacy,
    telegramBot,
    hasYandex,
}: {
    auth: any;
    googleApp: string;
    googleAppLegacy: string;
    telegramBot: string;
    hasYandex: boolean;
}) => {
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);

    // Состав привязок держится здесь, а не берётся из props на каждой отрисовке:
    // ответ ручки привязки приносит новый состав, и страница обновляется им.
    // Через router.refresh() было хуже — обновление пересоздавало дерево и
    // гасило только что показанное сообщение об исходе.
    const [links, setLinks] = useState({
        vk: auth?.vk?.userId || "",
        google: auth?.google?.userId || "",
        telegram: auth?.telegram?.userId || "",
        yandex: auth?.yandex?.userId || "",
    });

    const {vk: vkId, google: googleId, telegram: telegramId, yandex: yandexId} = links;

    // Сколько входов РАБОТАЕТ: ВК среди них нет, он закрыт. Последний рабочий
    // снимать не предлагаем — сервер его всё равно не отдаст (lib/authorize/link),
    // но кнопка, которая заведомо откажет, хуже отсутствующей.
    const working = [googleId, telegramId, yandexId].filter(Boolean).length;

    // Яндекс возвращается сюда переходом, и сказать о исходе может только адресом.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const outcome = params.get("link");
        if (!outcome) return;
        setMessage(MESSAGES[outcome] ?? MESSAGES.error);
        // Метку из адреса убираем: перезагрузи человек страницу — и он увидел бы
        // сообщение о том, чего сейчас не делал.
        params.delete("link");
        const rest = params.toString();
        window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
    }, []);

    // `done` — что сказать при удаче: у привязки и снятия она называется по-разному.
    const call = useCallback(async (init: RequestInit & { url: string }, done: string) => {
        setBusy(true);
        setMessage("");
        try {
            const {url, ...rest} = init;
            const res = await fetch(url, rest);
            if (res.status === 503) return setMessage(MESSAGES.off);
            const data = await res.json().catch(() => null);
            if (data?.links) setLinks(data.links);
            const outcome = data?.outcome ?? (res.ok ? "ok" : "error");
            setMessage(outcome === "ok" ? done : (MESSAGES[outcome] ?? MESSAGES.error));
        } catch (e) {
            reportClientError(e, "profile: привязка входа");
            setMessage(MESSAGES.network);
        } finally {
            setBusy(false);
        }
    }, []);

    const link = useCallback((body: Record<string, unknown>) => call({
        url: "/api/profile/link",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    }, MESSAGES.linked), [call]);

    const unlink = useCallback((provider: string) => call({
        url: `/api/profile/link?provider=${provider}`,
        method: "DELETE",
    }, MESSAGES.unlinked), [call]);

    const unlinkButton = (provider: string, label = "отвязать") => (
        <button type="button" className={BUTTON} disabled={busy} onClick={() => unlink(provider)}>
            {label}
        </button>
    );

    return (
        <div className="flex flex-col gap-3 pr-4 mt-4">
            <div>
                <h2 className="font-serif font-bold text-sm">Входы</h2>
                <p className="font-serif text-xs text-slate-600 mt-1">
                    Привязав второй вход, вы сможете попадать в эту же запись любым из них.
                    Хотя бы один рабочий вход остаться должен.
                </p>
            </div>

            {message && (
                <p role="status" className="font-serif text-xs text-slate-800 border border-slate-300 rounded px-2 py-1">
                    {message}
                </p>
            )}

            <div className={ROW}>
                <span className={LABEL}>Telegram</span>
                {telegramId ? (
                    <div className="flex items-center gap-3">
                        <span className="font-serif text-sm text-slate-600">{telegramId}</span>
                        {working > 1 && unlinkButton("Telegram")}
                    </div>
                ) : (
                    <TelegramLoginWidget
                        bot={telegramBot}
                        onAuth={(fields) => link({ type: "Telegram", data: { fields } })}
                    />
                )}
            </div>

            <div className={ROW}>
                <span className={LABEL}>Google</span>
                {googleId ? (
                    <div className="flex items-center gap-3">
                        <span className="font-serif text-sm text-slate-600">{googleId}</span>
                        {working > 1 && unlinkButton("Google")}
                    </div>
                ) : (
                    <GoogleSignIn
                        clientId={googleApp}
                        legacyClientId={googleAppLegacy}
                        text="continue_with"
                        width={280}
                        onCredential={(credential) => link({ type: "Google", data: { credential } })}
                    />
                )}
            </div>

            <div className={ROW}>
                <span className={LABEL}>Яндекс</span>
                {yandexId ? (
                    <div className="flex items-center gap-3">
                        <span className="font-serif text-sm text-slate-600">{yandexId}</span>
                        {working > 1 && unlinkButton("Yandex")}
                    </div>
                ) : hasYandex ? (
                    <a
                        href="/api/login/yandex/start?mode=link&next=/profile"
                        className={BUTTON}
                    >
                        Привязать Яндекс
                    </a>
                ) : (
                    <span className="font-serif text-xs text-slate-600">Привязка Яндекса не настроена.</span>
                )}
            </div>

            {/* ПЕРЕХОДНЫЙ ПЕРИОД: строка ВК показывается только тем, у кого он
                есть. Снять его можно всегда — он не в счёте рабочих входов, —
                но не последним: запись осталась бы вовсе без входа. */}
            {vkId && (
                <div className={ROW}>
                    <span className={LABEL}>ВКонтакте <span className="text-slate-500">(вход закрыт)</span></span>
                    <div className="flex items-center gap-3">
                        <span className="font-serif text-sm text-slate-600">{vkId}</span>
                        {working > 0 && unlinkButton("VK", "снять")}
                    </div>
                    {working === 0 && (
                        <p className="font-serif text-xs text-slate-600">
                            Это ваш единственный вход, и он закрыт. Привяжите любой из трёх выше —
                            прямо здесь, сейчас, пока вы в записи. Если попасть в неё уже нельзя,
                            напишите через{" "}
                            <Link href="/contact" className="text-red-900 hover:underline">обратную связь</Link>.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default memo(Logins);

'use client';
import React, {memo, useCallback, useEffect, useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useAppDispatch, useAppSelector} from "@/lib/hooks";
import {AuthSlice} from "@/lib/store/auth";
import {reportClientError} from "@/lib/reportClientError";
import {safeNextPath} from "@/lib/authorize/redirect";
import GoogleSignIn from "@/app/components/auth/GoogleSignIn";
import TelegramLoginWidget from "@/app/components/auth/TelegramLoginWidget";

/**
 * Что говорить, когда вход не состоялся.
 *
 * Прежде не говорилось ничего: ответ сервера разбирался как JSON независимо от
 * кода, и на 401 или 503 страница молча спотыкалась об исключение. Человек при
 * этом видел ровно то же, что и до нажатия, — то есть считал, что не попал по
 * кнопке.
 */
const MESSAGES: Record<string, string> = {
    "yandex-off": "Вход через Яндекс сейчас выключен.",
    "yandex-denied": "Вход через Яндекс не состоялся: доступ не был разрешён.",
    "yandex-state": "Вход через Яндекс не состоялся: не совпала проверочная строка. Попробуйте ещё раз.",
    "yandex-exchange": "Яндекс не подтвердил вход. Попробуйте ещё раз.",
    "yandex-info": "Яндекс не сказал, кто вошёл. Попробуйте ещё раз.",
    "telegram-off": "Вход через Telegram сейчас выключен.",
    "rejected": "Вход не подтверждён. Попробуйте ещё раз.",
    "server": "Не вышло завести учётную запись. Попробуйте позже.",
    "network": "Нет связи с сайтом. Проверьте подключение и попробуйте ещё раз.",
};

const ROW = "flex justify-center w-[320px] max-w-full min-h-[40px] items-center";

const Login = ({
    googleApp,
    googleAppLegacy,
    telegramBot,
    hasYandex,
}: {
    googleApp: string;
    /** ПЕРЕЕЗД, временно: клиент Google, знающий про старый адрес. */
    googleAppLegacy: string;
    telegramBot: string;
    hasYandex: boolean;
}) => {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const isAuthorized = useAppSelector(state => state.auth.isAuthorized);

    const [error, setError] = useState<string>("");
    // Куда вернуться после входа и что сказать о неудавшемся заходе — читается
    // из адреса в браузере, а не через useSearchParams: тот потребовал бы
    // границы Suspense и сделал бы страницу отрисовываемой на клиенте, а она
    // статическая и такой остаётся.
    const [next, setNext] = useState<string>("/");

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        setNext(safeNextPath(params.get("next")));
        const failed = params.get("error");
        if (failed) setError(MESSAGES[failed] ?? MESSAGES.rejected);
    }, []);

    /** Общий хвост всех входов: ответ сервера — и либо внутрь, либо словами. */
    const send = useCallback(async (payload: Record<string, unknown>) => {
        setError("");
        try {
            const res = await fetch("/api/login", {
                method: "POST",
                body: JSON.stringify(payload),
                headers: { 'Content-Type': 'application/json' },
            });
            if (res.status === 503) return setError(MESSAGES["telegram-off"]);
            if (res.status === 401) return setError(MESSAGES.rejected);
            if (!res.ok) return setError(MESSAGES.server);

            const data = await res.json();
            dispatch(AuthSlice.actions.SetAuthorized({
                isAuth: true,
                expiresAt: data.expiresAt,
                userId: data.userId,
                provider: data.provider,
            }));
            router.push(next);
        } catch (e) {
            reportClientError(e, "login: отправка входа");
            setError(MESSAGES.network);
        }
    }, [dispatch, router, next]);

    useEffect(() => {
        if (isAuthorized) router.push("/");
    }, [isAuthorized, router]);

    return (
        <div className="mx-auto w-full max-w-sm py-8 flex flex-col gap-6 font-serif">
            <div>
                <h1 className="font-bold text-xl">Вход</h1>
                <p className="text-slate-800 text-sm mt-2">
                    Вход нужен для помянника, записок, личных заметок и избранного. Читать
                    сайт, считать дни и выгружать тексты можно и без него.
                </p>
            </div>

            {error && (
                <p role="alert" className="text-sm text-red-800 border border-red-300 rounded px-3 py-2">
                    {error}
                </p>
            )}

            <div className="flex flex-col items-center gap-3">
                <div className={ROW}>
                    <TelegramLoginWidget
                        bot={telegramBot}
                        onAuth={(fields) => {
                            // Поля виджета как есть: строку для подписи собирает
                            // сервер, и идентификатор он берёт из них же
                            // (lib/authorize/telegram).
                            void send({ type: "Telegram", data: { fields } });
                        }}
                    />
                </div>
                <div className={ROW}>
                    <GoogleSignIn
                        clientId={googleApp}
                        legacyClientId={googleAppLegacy}
                        onCredential={(credential) => {
                            // Серверу нужен сам id_token: разбирать его в браузере
                            // незачем, всё равно подпись проверяет он.
                            void send({ type: "Google", data: { access_token: credential } });
                        }}
                    />
                </div>
                {hasYandex && (
                    <a
                        href={`/api/login/yandex/start?next=${encodeURIComponent(next)}`}
                        className={`${ROW} justify-center rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50`}
                    >
                        Войти через Яндекс
                    </a>
                )}
            </div>

            <p className="text-xs text-slate-600">
                Сейчас возможно зайти в вашу учетную запись через Telegram, Google или Яндекс.
            </p>

            {/* ПЕРЕХОДНЫЙ ПЕРИОД. Снимается, когда вошедшие через ВК разберутся:
                до тех пор это единственное место, где они узнают, что делать, —
                на страницу входа они и придут, обнаружив пропажу кнопки. */}
            <p className="text-xs text-slate-600 border-t border-slate-200 pt-3">
                <span className="text-slate-700">Вход через ВК закрыт.</span> Записи тех, кто
                входил им, — помянник, заметки, избранное — сохранены. Пока вы залогинены,
                проще всего привязать другой вход прямо в{" "}
                <Link href="/profile" className="text-red-900 hover:underline">профиле</Link>.
                Если попасть в неё уже нельзя, напишите через{" "}
                <Link href="/contact" className="text-red-900 hover:underline">форму обратной связи</Link>{" "}
                свой идентификатор ВК: на него будет выслано письмо с подтверждением, поэтому
                страница ВК должна быть открыта. Там же укажите, каким входом хотите
                пользоваться дальше и его идентификатор.
            </p>
        </div>
    )
};

export default memo(Login);

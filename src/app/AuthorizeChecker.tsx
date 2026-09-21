'use client';
import {memo, useCallback, useEffect} from "react";
import {useAppDispatch, useAppSelector} from "@/lib/hooks";
import {AuthSlice} from "@/lib/store/auth";

/**
 * Продление входа на открытой странице.
 *
 * Прежде здесь жил VK ID SDK: он обновлял токен VK и заводил сессию заново, а
 * вошедшие через Google и Telegram не продлевались никак — у этих двух обновления
 * такого рода нет, и вход у них кончался посреди чтения. Теперь продлевается наша
 * собственная сессия (lib/authorize/sessions), и способ входа для этого не важен.
 *
 * Сон ограничен шестью часами, хотя вход живёт неделю: таймер на неделю вперёд —
 * это таймер, который почти наверняка не сработает (вкладку закроют, машину
 * усыпят), а лишнее продление ничего не стоит и ничего не ломает.
 */
const BEFORE_EXPIRY_MS = 5 * 60 * 1000;
const MAX_SLEEP_MS = 6 * 60 * 60 * 1000;

const AuthorizeChecker = () => {
    const expiresAt = useAppSelector(state => state.auth.cookieExpiresAt);
    const isAuthorized = useAppSelector(state => state.auth.isAuthorized);
    const dispatch = useAppDispatch();

    const prolong = useCallback(async () => {
        try {
            const res = await fetch("/api/prolong", { method: "POST", keepalive: true });
            // 401 — вход кончился или упёрся в предел: показывать «вы вошли»
            // дальше нельзя, иначе кнопки будут молча ничего не делать.
            if (res.status === 401) {
                dispatch(AuthSlice.actions.Logout());
                return;
            }
            if (!res.ok) return;
            const data = await res.json();
            if (data?.expiresAt) dispatch(AuthSlice.actions.Prolonged(data.expiresAt));
        } catch (e) {
            // Нет связи — не повод выбрасывать: попробуем в следующий раз.
        }
    }, [dispatch]);

    useEffect(() => {
        if (!isAuthorized || !expiresAt) return;

        const left = +(new Date(expiresAt)) - Date.now();
        if (left <= 0) {
            dispatch(AuthSlice.actions.Logout());
            return;
        }

        const delay = Math.max(0, Math.min(left - BEFORE_EXPIRY_MS, MAX_SLEEP_MS));
        const timer = setTimeout(prolong, delay);
        return () => clearTimeout(timer);
    }, [expiresAt, isAuthorized, prolong, dispatch]);

    return null;
};

export default memo(AuthorizeChecker);

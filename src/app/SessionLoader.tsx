'use client';
import {memo, useEffect} from "react";
import {useAppDispatch} from "@/lib/hooks";
import {AuthSlice} from "@/lib/store/auth";

// Подтягивает сессию с клиента после монтирования. Раньше это делал корневой
// layout через verifySession() — из-за чтения cookies весь сайт рендерился
// динамически, включая страницы чтений, которые меняются раз в месяцы.
const SessionLoader = () => {
    const dispatch = useAppDispatch();

    useEffect(() => {
        let cancelled = false;

        fetch("/api/session")
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (cancelled) return;
                if (!data?.isAuth) {
                    dispatch(AuthSlice.actions.SetResolved());
                    return;
                }
                dispatch(AuthSlice.actions.SetAuthorized({
                    isAuth: true,
                    userId: data.userId,
                    expiresAt: data.expiresAt,
                    user: data.user,
                }));
            })
            .catch(() => {
                if (!cancelled) dispatch(AuthSlice.actions.SetResolved());
            });

        return () => {
            cancelled = true;
        };
    }, [dispatch]);

    return null;
};

export default memo(SessionLoader);

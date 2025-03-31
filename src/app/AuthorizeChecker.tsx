'use client';
import {memo, useCallback, useEffect} from "react";
import {useAppDispatch, useAppSelector} from "@/lib/hooks";
import * as VKID from "@vkid/sdk";
import {AuthSlice} from "@/lib/store/auth";

let timeout: NodeJS.Timeout|null = null;

const diff = 1000 * 60 * 5; // 5 minutes

const AuthorizeChecker = ({ vkApp, codeVerifier, }: {
    vkApp: number;
    codeVerifier: string;
}) => {
    const expiresAt = useAppSelector(state => state.auth.cookieExpiresAt);
    // const auth = useAppSelector(state => state.auth);
    const dispatch = useAppDispatch();

    const prolong = useCallback(() => {
        fetch("/api/prolong", {
            method: "POST",
        }).then((res) => res.json()).then((res) => {
            VKID.Auth.refreshToken(res.state?.refresh_token, res.deviceId).then(async (data) => {
                const loginRes = await fetch("/api/login", {
                    method: "POST",
                    body: JSON.stringify({
                        type: "VK",
                        data,
                        timestamp: Date.now(),
                        deviceId: res.deviceId,
                    }),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
                const loginData = await loginRes.json();
                dispatch(AuthSlice.actions.SetAuthorized({
                    isAuth: true,
                    userId: loginData.userId,
                    expiresAt: loginData.expiresAt,
                }));
            });
        });
    }, []);

    useEffect(() => {
        VKID.Config.init({
            app: vkApp,
            redirectUrl: 'https://typikon.su/login',
            responseMode: VKID.ConfigResponseMode.Callback,
            codeVerifier,
            source: VKID.ConfigSource.LOWCODE,
            scope: '', // Заполните нужными доступами по необходимости
        });
    }, []);

    useEffect(() => {
        if (expiresAt) {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            if (+(new Date(expiresAt!)) - Date.now() > diff) {
                timeout = setTimeout(() => {
                    prolong();
                }, +(new Date(expiresAt!)) - Date.now() - diff);
            } else { // Less than 5 minutes left to expire token
                prolong();
            }
        }
    }, [expiresAt]);
    return null;
};

export default memo(AuthorizeChecker);
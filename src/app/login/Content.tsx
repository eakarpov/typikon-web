'use client';
import React, {memo, useEffect, useRef, useState} from "react";
import * as VKID from '@vkid/sdk';
import {TokenResult} from "@vkid/sdk/dist-sdk/types/auth/types";
import {useAppDispatch, useAppSelector} from "@/lib/hooks";
import {useRouter} from "next/navigation";
import {AuthSlice} from "@/lib/store/auth";
import Script from "next/script";
import {reportClientError} from "@/lib/reportClientError";
import { isLegacyHost, VK_REDIRECT_URL } from "@/utils/site";

const Login = ({
    vkApp,
    hasVkAuth,
    googleApp,
    googleAppLegacy,
}: {
    vkApp: number;
    hasVkAuth?: boolean;
    googleApp: string;
    /** ПЕРЕЕЗД, временно: клиент Google, знающий про старый адрес. */
    googleAppLegacy: string;
}) => {
    // Какой клиент Google подставить, видно только в браузере: у Google список
    // разрешённых источников у каждого клиента свой, и на старом адресе новый
    // клиент вход не даст. На сервере адрес не спрашиваем нарочно — страница
    // осталась бы динамической ради трёх месяцев.
    const [googleClient, setGoogleClient] = useState(googleApp);

    useEffect(() => {
        if (isLegacyHost(window.location.hostname)) setGoogleClient(googleAppLegacy);
    }, [googleAppLegacy]);

    const buttonRef = useRef(null);
    const router = useRouter();
    const dispatch = useAppDispatch();
    const id = new Date().getTime();
    const id2 = new Date().getTime() + 5;

    const isAuthorized = useAppSelector(state => state.auth.isAuthorized);

    useEffect(() => {
        if (!hasVkAuth) return;
        VKID.Config.init({
            app: vkApp,
            redirectUrl: VK_REDIRECT_URL,
            responseMode: VKID.ConfigResponseMode.Callback,
            // codeVerifier не задаётся: SDK порождает его сам на каждый вход.
            // Прежде сюда шло одно постоянное значение из окружения сервера.
            source: VKID.ConfigSource.LOWCODE,
            scope: '', // Заполните нужными доступами по необходимости
        });
        const oneTap = new VKID.OneTap();
        if (buttonRef.current) {
            oneTap.render({
                container: buttonRef.current,
                showAlternativeLogin: true,
                skin: VKID.OneTapSkin.Secondary,
            })
                .on(VKID.WidgetEvents.ERROR, vkidOnError)
                .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS,  (payload: { code: string; device_id: string; }) => {
                    const code = payload.code;
                    const deviceId = payload.device_id;

                    VKID.Auth.exchangeCode(code, deviceId)
                        .then(vkidOnSuccess(deviceId))
                        .catch(vkidOnError);
                });
        }
    }, [vkApp, hasVkAuth]);

    const vkidOnSuccess = (deviceId: string) => async (data: Omit<TokenResult, "id_token">) => {
        await fetch("/api/login", {
            method: "POST",
            body: JSON.stringify({
                type: "VK",
                data,
                timestamp: Date.now(),
                deviceId,
            }),
            headers: {
                'Content-Type': 'application/json',
            },
        }).then(res => res.json()).then((res) => {
            dispatch(AuthSlice.actions.SetAuthorized({
                isAuth: true,
                expiresAt: res.expiresAt,
                userId: res.userId,
                isVK: res.isVK,
                isGoogle: res.isGoogle,
            }));
        });
        router.push("/");
    }

    const vkidOnError = (error: any) => {
        reportClientError(error, "login: вход через VK ID");
    };

    const decodeJWT = (token: string) => {

        let base64Url = token.split(".")[1];
        let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        let jsonPayload = decodeURIComponent(
            atob(base64)
                .split("")
                .map(function (c) {
                    return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
                })
                .join("")
        );
        return JSON.parse(jsonPayload);
    }

    useEffect(() => {
        window.handleCredentialResponse = async (response: any) => {
            const responsePayload = decodeJWT(response.credential);
            await fetch("/api/login", {
                method: "POST",
                body: JSON.stringify({
                    type: "Google",
                    data: {
                        access_token: response,
                        expires_in: responsePayload.exp,
                        user_id: responsePayload.sub,
                    },
                    timestamp: Date.now(),
                    deviceId: Navigator.toString(),
                }),
                headers: {
                    'Content-Type': 'application/json',
                },
            }).then(res => res.json()).then((res) => {
                dispatch(AuthSlice.actions.SetAuthorized({
                    isAuth: true,
                    expiresAt: res.expiresAt,
                    userId: res.userId,
                }));
            });
            router.push("/");
        }
    }, []);

    useEffect(() => {
        if (isAuthorized) {
            router.push("/");
        }
    }, [isAuthorized]);

    useEffect(() => {
        window.onTelegramAuth = async (userData: any) => {
            const toSave = {
                type: "Telegram",
                // Поля виджета как есть: строку для подписи собирает сервер, и
                // идентификатор он берёт из них же (lib/authorize/telegram).
                data: { fields: userData },
                timestamp: Date.now(),
                deviceId: Navigator.toString(),
            };
            await fetch("/api/login", {
                method: "POST",
                body: JSON.stringify(toSave),
                headers: {
                    'Content-Type': 'application/json',
                },
            }).then(res => res.json()).then((res) => {
                dispatch(AuthSlice.actions.SetAuthorized({
                    isAuth: true,
                    expiresAt: res.expiresAt,
                    userId: res.userId,
                }));
            });
            router.push("/");
        };
    }, []);

    return (
        <div>
            <label>
                Авторизация
            </label>
            <div ref={buttonRef} />
            <Script
                id={id.toString()}
                src={`https://accounts.google.com/gsi/client?v=${id}`}
            ></Script>
            <Script
                id={id2.toString()}
                async
                src="https://telegram.org/js/telegram-widget.js?23"
                data-telegram-login="typikonBot"
                data-size="large"
                data-onauth="onTelegramAuth(user)"
                data-request-access="write"
            />
            <div
                id="g_id_onload"
                data-auto_prompt="false"
                data-callback="handleCredentialResponse"
                data-use_fedcm_for_prompt="true"
                data-use_fedcm_for_button="true"
                data-client_id={googleClient}
            ></div>
            <div className="g_id_signin"></div>
        </div>
    )
};

export default memo(Login);

'use client';
import React, {memo, useEffect, useRef} from "react";
import * as VKID from '@vkid/sdk';
import {TokenResult} from "@vkid/sdk/dist-sdk/types/auth/types";
import {useAppDispatch, useAppSelector} from "@/lib/hooks";
import {useRouter} from "next/navigation";
import {AuthSlice} from "@/lib/store/auth";

const Login = ({
    vkApp,
    yandexApp,
    codeVerifier,
}: {
    vkApp: number;
    codeVerifier: string;
    yandexApp: string;
}) => {
    const buttonRef = useRef(null);
    const router = useRouter();
    const dispatch = useAppDispatch();

    const isAuthorized = useAppSelector(state => state.auth.isAuthorized);

    useEffect(() => {
        VKID.Config.init({
            app: vkApp,
            redirectUrl: 'https://typikon.su/login',
            responseMode: VKID.ConfigResponseMode.Callback,
            codeVerifier,
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
    }, [vkApp]);

    useEffect(() => {
        window.YaAuthSuggest.init(
            {
                client_id: yandexApp,
                response_type: 'token',
                redirect_url: "https://typikon.su/login"
            },
            "https://typikon.su",
            {
                view: "button",
                parentId: "yandexAuth",
                buttonSize: 'm',
                buttonView: 'main',
                buttonTheme: 'light',
                buttonBorderRadius: "0",
                buttonIcon: 'ya',
            }
        )
            .then(({handler}) => handler())
            .then(data => console.log('Сообщение с токеном', data))
            .catch(error => console.log('Обработка ошибки', error))
    }, [yandexApp]);

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
            }));
        });
        router.push("/");
    }

    const vkidOnError = (error: any) => {
        console.log(error);
    };

    useEffect(() => {
        if (isAuthorized) {
            router.push("/");
        }
    }, [isAuthorized]);

    return (
        <div>
            <label>
                Авторизация
            </label>
            <div ref={buttonRef}>

            </div>
            <div id="yandexAuth" />
        </div>
    )
};

export default memo(Login);

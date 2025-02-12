'use client';
import React, {memo, useEffect, useRef} from "react";
import * as VKID from '@vkid/sdk';
import {TokenResult} from "@vkid/sdk/dist-sdk/types/auth/types";

const Login = ({ vkApp }: { vkApp: number; }) => {
    const buttonRef = useRef(null);

    useEffect(() => {
        VKID.Config.init({
            app: vkApp,
            redirectUrl: 'https://typikon.su/login',
            responseMode: VKID.ConfigResponseMode.Callback,
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
                        .then(vkidOnSuccess)
                        .catch(vkidOnError);
                });
        }
    }, [vkApp]);

    const vkidOnSuccess = (data: Omit<TokenResult, "id_token">) => {
        console.log(data);
        fetch("/login", {
            method: "POST",
            body: JSON.stringify({
                type: "VK",
                data,
                timestamp: Date.now(),
            }),
        });
        // Обработка полученного результата
    }

    const vkidOnError = (error: any) => {
        console.log(error);
        // Обработка ошибки
    };

    return (
        <div>
            <label>
                Авторизация
            </label>
            <div ref={buttonRef}>

            </div>
        </div>
    )
};

export default memo(Login);

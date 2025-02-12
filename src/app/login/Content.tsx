'use client';
import React, {memo, useEffect, useRef} from "react";
import * as VKID from '@vkid/sdk';
import {TokenResult} from "@vkid/sdk/dist-sdk/types/auth/types";
import {useAppSelector} from "@/lib/hooks";
import {redirect} from "next/navigation";

const Login = ({ vkApp, codeVerifier }: { vkApp: number; codeVerifier: string; }) => {
    const buttonRef = useRef(null);

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
                        .then(vkidOnSuccess)
                        .catch(vkidOnError);
                });
        }
    }, [vkApp]);

    const vkidOnSuccess = (data: Omit<TokenResult, "id_token">) => {
        fetch("/api/login", {
            method: "POST",
            body: JSON.stringify({
                type: "VK",
                data,
                timestamp: Date.now(),
            }),
        }).then(() => {
            redirect("/");
        });
    }

    const vkidOnError = (error: any) => {
        console.log(error);
    };

    if (isAuthorized) {
        redirect("/");
    }

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

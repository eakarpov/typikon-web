'use client';
import React, {memo, useCallback, useEffect, useRef} from "react";
import * as VKID from '@vkid/sdk';
import {TokenResult} from "@vkid/sdk/dist-sdk/types/auth/types";
import {useAppDispatch, useAppSelector} from "@/lib/hooks";
import {useRouter} from "next/navigation";
import {AuthSlice} from "@/lib/store/auth";
import { signIn } from "next-auth/react";

const Login = ({
    vkApp,
    codeVerifier,
    googleApp,
}: {
    vkApp: number;
    codeVerifier: string;
    yandexApp: string;
    googleApp: string;
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

   const onGoogleAuth = useCallback(() => {
       signIn("google");
   }, []);

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

    const decodeJWT = (token) => {

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

    const handleCredentialResponse = (response) =>  {

        console.log("Encoded JWT ID token: " + response.credential);

        const responsePayload = decodeJWT(response.credential);

        console.log("Decoded JWT ID token fields:");
        console.log("  Full Name: " + responsePayload.name);
        console.log("  Given Name: " + responsePayload.given_name);
        console.log("  Family Name: " + responsePayload.family_name);
        console.log("  Unique ID: " + responsePayload.sub);
        console.log("  Profile image URL: " + responsePayload.picture);
        console.log("  Email: " + responsePayload.email);
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
            <div id="yandexAuth"/>

            <div onClick={onGoogleAuth}>
                Гугл
            </div>
            <div
                id="g_id_onload"
                data-auto_prompt="false"
                data-callback="handleCredentialResponse"
                data-use_fedcm_for_prompt="true"
                data-use_fedcm_for_button="true"
                data-client_id={googleApp}
            ></div>
            <div className="g_id_signin"></div>
        </div>
    )
};

export default memo(Login);

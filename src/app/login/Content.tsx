'use client';
import React, {memo, useEffect, useRef} from "react";
import * as VKID from '@vkid/sdk';
import {TokenResult} from "@vkid/sdk/dist-sdk/types/auth/types";
import {useAppDispatch, useAppSelector} from "@/lib/hooks";
import {useRouter} from "next/navigation";
import {AuthSlice} from "@/lib/store/auth";
import Script from "next/script";

const Login = ({
    vkApp,
    hasVkAuth,
    codeVerifier,
    googleApp,
}: {
    vkApp: number;
    hasVkAuth?: boolean;
    codeVerifier: string;
    googleApp: string;
}) => {
    const buttonRef = useRef(null);
    const router = useRouter();
    const dispatch = useAppDispatch();
    const id = new Date().getTime();

    const isAuthorized = useAppSelector(state => state.auth.isAuthorized);

    useEffect(() => {
        if (!hasVkAuth) return;
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
        console.log(error);
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
            console.log(response);
            const responsePayload = decodeJWT(response.credential);
            console.log("ID: " + responsePayload.sub);
            console.log('Full Name: ' + responsePayload.name);
            console.log('Given Name: ' + responsePayload.given_name);
            console.log('Family Name: ' + responsePayload.family_name);
            console.log("Image URL: " + responsePayload.picture);
            console.log("Email: " + responsePayload.email);
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

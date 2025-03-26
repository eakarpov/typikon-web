'use client';
import {memo, useCallback, useEffect} from "react";
import {useAppSelector} from "@/lib/hooks";
import * as VKID from "@vkid/sdk";

let timeout: NodeJS.Timeout|null = null;

const diff = 1000 * 60 * 5; // 5 minutes

const AuthorizeChecker = () => {
    const expiresAt = useAppSelector(state => state.auth.cookieExpiresAt);
    const auth = useAppSelector(state => state.auth);
    console.log(auth);
    const prolong = useCallback(() => {
        fetch("/api/prolong", {
            method: "POST",
        }).then((res) => res.json()).then((res) => {
            VKID.Auth.refreshToken(res.state?.refresh_token, res.deviceId).then(async (data) => {
                await fetch("/api/login", {
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
                })
            });
        });
    }, []);

    useEffect(() => {
        console.log(expiresAt);
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
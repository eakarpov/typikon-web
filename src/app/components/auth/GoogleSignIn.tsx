'use client';
import {memo, useEffect, useRef, useState} from "react";
import {reportClientError} from "@/lib/reportClientError";
import {isLegacyHost} from "@/utils/site";

/**
 * Кнопка Google — одна на два места: вход и привязка в профиле.
 *
 * Сценарий Google загружается САМ, а не через next/script: компонент живёт на
 * двух страницах, и две одинаковые декларации сценария рано или поздно разошлись
 * бы. Обещание модульное, поэтому вторая кнопка на той же странице дождётся уже
 * начатой загрузки, а не начнёт свою.
 */
let gsi: Promise<void> | null = null;

const loadGsi = (): Promise<void> => {
    if (gsi) return gsi;
    gsi = new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => {
            // Обещание не запоминается отказом: следующая попытка (перезаход на
            // страницу) должна начать загрузку заново, а не получить старый отказ.
            gsi = null;
            reject(new Error("не загрузился accounts.google.com/gsi/client"));
        };
        document.head.appendChild(script);
    });
    return gsi;
};

const GoogleSignIn = ({
    clientId,
    legacyClientId,
    text = "signin_with",
    width = 320,
    onCredential,
}: {
    clientId: string;
    /** ПЕРЕЕЗД, временно: клиент, знающий про старый адрес. */
    legacyClientId?: string;
    /** Надпись на кнопке: у входа «Войти», у привязки — «Продолжить». */
    text?: "signin_with" | "continue_with";
    width?: number;
    onCredential: (credential: string) => void;
}) => {
    const ref = useRef<HTMLDivElement>(null);
    // Какой клиент подставить, видно только в браузере: у Google список
    // разрешённых источников у каждого клиента свой, и на старом адресе новый
    // клиент кнопку не даст. На сервере адрес не спрашиваем нарочно — страница
    // осталась бы динамической ради трёх месяцев.
    const [resolved, setResolved] = useState<string>("");
    const handler = useRef(onCredential);
    useEffect(() => { handler.current = onCredential; }, [onCredential]);

    useEffect(() => {
        setResolved(isLegacyHost(window.location.hostname) && legacyClientId
            ? legacyClientId
            : clientId);
    }, [clientId, legacyClientId]);

    useEffect(() => {
        if (!resolved || !ref.current) return;
        let cancelled = false;

        loadGsi().then(() => {
            if (cancelled || !ref.current) return;
            const google = window.google;
            if (!google?.accounts?.id) return;

            // Обработчик передаётся прямо сюда, а не назначается именем у окна:
            // имя пришлось бы ставить до загрузки сценария и гадать, кто успеет
            // раньше.
            google.accounts.id.initialize({
                client_id: resolved,
                use_fedcm_for_prompt: true,
                callback: (response: any) => {
                    if (typeof response?.credential === "string") handler.current(response.credential);
                },
            });
            google.accounts.id.renderButton(ref.current, {
                type: "standard",
                theme: "outline",
                size: "large",
                text,
                shape: "rectangular",
                locale: "ru",
                width,
            });
        }).catch((e) => reportClientError(e, "GoogleSignIn: загрузка сценария"));

        return () => { cancelled = true; };
    }, [resolved, text, width]);

    return <div ref={ref} />;
};

export default memo(GoogleSignIn);

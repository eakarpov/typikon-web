import { createSign } from "node:crypto";

// ОТПРАВКА ТОЛЧКА — без библиотеки.
//
// `firebase-admin` тянет за собой полсотни пакетов ради того, что здесь
// умещается в тридцать строк: подписать JWT служебным ключом, обменять его на
// пропуск и отправить одно сообщение. Всё, что делает эта служба, — будит
// приложение; ни базы, ни хранилища, ни аналитики нам от неё не нужно.
//
// Учётные данные — в переменных окружения, а не файлом в репозитории: закрытый
// ключ служебной записи открывает отправку кому угодно от нашего имени.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

export interface FcmCredentials {
    projectId: string;
    clientEmail: string;
    privateKey: string;
}

/**
 * Учётные данные из окружения; `null` — не настроено.
 *
 * `null`, а не бросок: рассылка должна уметь сказать «не настроено» словами и
 * закончиться, а не упасть в крон стеком вызовов.
 */
export const credentials = (env: NodeJS.ProcessEnv = process.env): FcmCredentials | null => {
    const projectId = env.FCM_PROJECT_ID;
    const clientEmail = env.FCM_CLIENT_EMAIL;
    // В .env перевод строки не живёт: закрытый ключ кладут с «\n» и разворачивают
    // при чтении. Забыть об этом — получить «error:1E08010C:DECODER routines».
    const privateKey = env.FCM_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) return null;
    return { projectId, clientEmail, privateKey };
};

const base64url = (value: string | Buffer): string =>
    Buffer.from(value).toString("base64")
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Подписанный служебный JWT: им и берётся пропуск. */
const assertion = (creds: FcmCredentials, now: number): string => {
    const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = base64url(JSON.stringify({
        iss: creds.clientEmail,
        scope: SCOPE,
        aud: TOKEN_URL,
        iat: now,
        exp: now + 3600,
    }));

    const signature = createSign("RSA-SHA256")
        .update(`${header}.${claims}`)
        .sign(creds.privateKey);

    return `${header}.${claims}.${base64url(signature)}`;
};

// Пропуск живёт час; в рассылке на тысячу устройств брать его тысячу раз незачем.
let cachedToken: { value: string; until: number } | null = null;

export const accessToken = async (
    creds: FcmCredentials,
    now: number = Math.floor(Date.now() / 1000),
): Promise<string> => {
    if (cachedToken && cachedToken.until > now + 60) return cachedToken.value;

    const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: assertion(creds, now),
        }),
    });

    if (!response.ok) {
        throw new Error(`пропуск не выдан: ${response.status} ${await response.text()}`);
    }

    const body = await response.json();
    cachedToken = { value: body.access_token, until: now + (body.expires_in ?? 3600) };
    return cachedToken.value;
};

export type SendOutcome = "sent" | "gone" | "failed";

/**
 * Послать одно пустое сообщение.
 *
 * **`data`, а не `notification`.** Сообщение с `notification` система показывает
 * сама, готовым текстом — то есть текст пришлось бы отправлять через чужие
 * серверы. Здесь его нет вовсе: `data` будит приложение, а что сказать, оно
 * решает по своему зеркалу тем же правилом, что и без сети.
 *
 * `gone` — ключ мёртв (переустановили, снесли приложение). Такой надо забыть, а
 * не считать поломкой: иначе рассылка год за годом стучится в пустоту.
 */
export const sendData = async (
    token: string,
    data: Record<string, string>,
    creds: FcmCredentials,
): Promise<SendOutcome> => {
    const pass = await accessToken(creds);

    const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${creds.projectId}/messages:send`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${pass}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message: {
                    token,
                    data,
                    android: {
                        // Напоминание о поминальном дне ждать не может: сутки
                        // спустя оно уже не о чем. Час — и хватит.
                        ttl: "3600s",
                        priority: "high",
                    },
                },
            }),
        },
    );

    if (response.ok) return "sent";
    if (response.status === 404 || response.status === 400) return "gone";
    return "failed";
};

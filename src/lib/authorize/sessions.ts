'use server';
import "server-only";
import clientPromise from "@/lib/mongodb";
import {SignJWT, jwtVerify} from 'jose';
import {cookies} from "next/headers";
import {ObjectId} from "mongodb";
import {AUTH_KEY, type Provider} from "@/lib/authorize/providers";

const secretKey = process.env.SESSION_SECRET;
const encodedKey = new TextEncoder().encode(secretKey);

/**
 * Сколько живёт вход.
 *
 * Прежде здесь стоял час, и час этот был не решением, а следом VK: сессия жила
 * ровно столько, сколько жил его токен доступа, а двигал её на открытой странице
 * VK ID SDK. Вошедшему через Google или Telegram продлевать было нечем — ни у
 * того, ни у другого обновления такого рода нет вовсе, — и вход у них кончался
 * через час молча, посреди чтения.
 *
 * С уходом VK срок стал наш собственный, и устроен он двумя числами. Окно
 * скольжения двигает `prolongSession` — при каждом обращении к `/api/prolong`
 * (страница зовёт его сама) и, значит, у того, кто заходит хотя бы раз в неделю,
 * вход не кончается никогда. Предел от НАЧАЛА входа не двигается ничем: через
 * три месяца нужно войти заново, сколько бы ты ни ходил по сайту. Второе число
 * и есть ответ на «а если увели cookie»: украденное живёт не вечно.
 */
const SESSION_WINDOW_SEC = 7 * 24 * 60 * 60;
const SESSION_ABSOLUTE_SEC = 90 * 24 * 60 * 60;

export async function encrypt(payload: any, expiresAt: Date) {
    // Срок подписи совпадает со сроком сессии, а не задан отдельной строкой:
    // разойдись они — cookie пережила бы запись в базе или наоборот, и вход
    // кончался бы не тогда, когда написано.
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(expiresAt)
        .sign(encodedKey)
}

export async function decrypt(session: string | undefined = '') {
    try {
        const { payload } = await jwtVerify(session, encodedKey, {
            algorithms: ['HS256'],
        })
        return payload
    } catch (error) {
        return null;
    }
}

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
} as const;

const setSessionCookie = async (token: string, expiresAt: Date) => {
    const cookieStore = await cookies();
    cookieStore.set('session', token, { ...COOKIE_OPTIONS, expires: expiresAt });
};

/**
 * Срок считается от времени СЕРВЕРА. Прежде он складывался из присланных
 * клиентом `timestamp` и `expires_in` — то есть назначался самим клиентом.
 */
export const createNewSession = async (
    id: string,
    state: Record<string, unknown>,
    ip: string,
    deviceId: string,
    type: Provider,
) => {
    const key = AUTH_KEY[type];
    if (!key) return 0;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_WINDOW_SEC * 1000);

    const client = await clientPromise;
    const db = client.db("typikon-users");

    // Три ветки с одинаковым телом свелись к одной: различие между входами —
    // только имя ключа в `auth`, и различать их разветвлением значило бы
    // заводить четвёртую копию на каждый новый способ входа.
    const newSession = await db
        .collection("sessions")
        .insertOne({
            id,
            ip,
            provider: type,
            createdAt: now,
            auth: {
                [key]: {
                    state,
                    deviceId,
                },
            },
            expiresAt,
        });

    const sessionId = newSession.insertedId;

    const session = await encrypt({ sessionId, expiresAt, userId: id }, expiresAt);
    await setSessionCookie(session, expiresAt);
    return expiresAt;
};

/**
 * Сдвинуть окно. Возвращает новый срок или `null`, если двигать нечего: сессии
 * нет, она уже кончилась или упёрлась в предел от начала входа.
 */
export const prolongSession = async (): Promise<Date | null> => {
    const cookieStore = await cookies();
    const payload = await decrypt(cookieStore.get('session')?.value);
    if (!payload?.sessionId) return null;

    const client = await clientPromise;
    const db = client.db("typikon-users");
    const _id = new ObjectId(payload.sessionId as string);

    const session = await db.collection("sessions").findOne({ _id });
    if (!session) return null;

    const now = Date.now();
    if (session.expiresAt instanceof Date && session.expiresAt.getTime() <= now) return null;

    // У сессий, заведённых до этой правки, `createdAt` нет. Считаем их
    // начавшимися сейчас: жить им оставалось меньше часа, и предел, отсчитанный
    // от этой минуты, для них всё равно недостижим.
    const startedAt = session.createdAt instanceof Date ? session.createdAt.getTime() : now;
    const limit = startedAt + SESSION_ABSOLUTE_SEC * 1000;
    if (now >= limit) return null;

    const expiresAt = new Date(Math.min(now + SESSION_WINDOW_SEC * 1000, limit));
    await db.collection("sessions").updateOne({ _id }, {
        $set: session.createdAt instanceof Date
            ? { expiresAt }
            : { expiresAt, createdAt: new Date(startedAt) },
    });

    const token = await encrypt({
        sessionId: payload.sessionId,
        expiresAt,
        userId: payload.userId,
    }, expiresAt);
    await setSessionCookie(token, expiresAt);
    return expiresAt;
};

export async function deleteSession(session: any) {
    const client = await clientPromise;
    const db = client.db("typikon-users");

    if (session) {
        await db
            .collection("sessions")
            .deleteOne({
                _id: new ObjectId(session.sessionId as string),
            });
    }
}

export async function getSession(): Promise<any> {
    const cookieStore = await cookies()
    const cookie = cookieStore.get('session')?.value;
    const session = await decrypt(cookie);

    const client = await clientPromise;
    const db = client.db("typikon-users");

    if (session) {
        const res = await db
            .collection("sessions")
            .findOne({
                _id: new ObjectId(session.sessionId as string),
            });
        return res;
    }
    return null;
}

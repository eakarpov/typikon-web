'use server';
import "server-only";
import clientPromise from "@/lib/mongodb";
import {SignJWT, jwtVerify} from 'jose';
import {cookies} from "next/headers";
import {ObjectId} from "mongodb";

const secretKey = process.env.SESSION_SECRET;
const encodedKey = new TextEncoder().encode(secretKey);

export async function encrypt(payload: any) {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h') // from VK token, may be another value
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

/** Предел жизни сессии; совпадает со сроком JWT в `encrypt`. */
const SESSION_MAX_SEC = 60 * 60;

/**
 * Срок считается от времени СЕРВЕРА. Прежде он складывался из присланных
 * клиентом `timestamp` и `expires_in` — то есть назначался самим клиентом.
 * `providerExpiresIn` — срок токена у провайдера (у VK), он может только
 * укоротить сессию, но не продлить её сверх предела.
 */
export const createNewSession = async (
    id: string,
    state: Record<string, unknown>,
    ip: string,
    deviceId: string,
    type: string,
    providerExpiresIn?: number,
) => {
    const lifetimeSec = providerExpiresIn && Number.isFinite(providerExpiresIn) && providerExpiresIn > 0
        ? Math.min(providerExpiresIn, SESSION_MAX_SEC)
        : SESSION_MAX_SEC;
    const expiresAt = new Date(Date.now() + lifetimeSec * 1000);

    const client = await clientPromise;
    const db = client.db("typikon-users");

    let newSession;

    if (type === "VK") {
        newSession = await db
            .collection("sessions")
            .insertOne({
                id,
                ip,
                auth: {
                    vk: {
                        state,
                        deviceId,
                    },
                },
                expiresAt,
            });
    }
    if (type === "Google") {
        newSession = await db
            .collection("sessions")
            .insertOne({
                id,
                ip,
                auth: {
                    google: {
                        state,
                        deviceId,
                    },
                },
                expiresAt,
            });
    }
    if (type === "Telegram") {
        newSession = await db
            .collection("sessions")
            .insertOne({
                id,
                ip,
                auth: {
                    telegram: {
                        state,
                        deviceId,
                    },
                },
                expiresAt,
            });
    }

    if (!newSession) return 0;

    const sessionId = newSession.insertedId;

    // 2. Encrypt the session ID
    const session = await encrypt({ sessionId, expiresAt: new Date(
     // timestamp + 1000 * 60 * 6
      expiresAt,
    ), userId: id, });

    const cookieStore = await cookies()
    cookieStore.set('session', session, {
        httpOnly: true,
        secure: true,
        expires: new Date(
            // timestamp + 1000 * 60 * 6
            expiresAt
        ),
        sameSite: 'lax',
        path: '/',
    });
    return expiresAt;
};

export async function deleteSession(session: any) {
    // cookieStore.set('session', '', { maxAge: 0 });

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
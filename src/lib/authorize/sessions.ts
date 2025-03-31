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
        .setExpirationTime('6m') // from VK token, may be another value
        .sign(encodedKey)
}

export async function decrypt(session: string | undefined = '') {
    try {
        const { payload } = await jwtVerify(session, encodedKey, {
            algorithms: ['HS256'],
        })
        return payload
    } catch (error) {
        // console.log('Failed to verify session', secretKey, error)
        return null;
    }
}

export const createNewSession = async (id: string, state: any, ip: string, timestamp: number, deviceId: string) => {
    const expiresAt = new Date(timestamp + state.expires_in * 1000);

    const client = await clientPromise;
    const db = client.db("typikon-users");

    const newSession = await db
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

    const sessionId = newSession.insertedId;

    // 2. Encrypt the session ID
    const session = await encrypt({ sessionId, expiresAt: new Date(
     timestamp + 1000 * 60 * 6
      // expiresAt,
    ), userId: id, });

    const cookieStore = await cookies()
    cookieStore.set('session', session, {
        httpOnly: true,
        secure: true,
        expires: new Date(
            timestamp + 1000 * 60 * 6
            // expiresAt
        ),
        sameSite: 'lax',
        path: '/',
    });
    return expiresAt;
};

export async function deleteSession() {
    const cookieStore = await cookies()
    const cookie = cookieStore.get('session')?.value;
    const session = await decrypt(cookie);
    cookieStore.delete('session')

    const client = await clientPromise;
    const db = client.db("typikon-users");

    if (session) {
        await db
            .collection("sessions")
            .deleteOne({
                _id: session.sessionId,
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
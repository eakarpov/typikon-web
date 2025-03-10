'use server';
import "server-only";
import clientPromise from "@/lib/mongodb";
import {SignJWT, jwtVerify} from 'jose';
import {cookies} from "next/headers";

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
        // console.log('Failed to verify session', secretKey, error)
        return null;
    }
}

export const createNewSession = async (id: string, state: any, ip: string, timestamp: number) => {
    const expiresAt = new Date(timestamp + state.expires_in * 1000);

    const client = await clientPromise;
    const db = client.db("typikon-users");

    const newSession = await db
        .collection("sessions")
        .insertOne({
            id,
            ip,
            auth: {
                vk: state,
            },
            expiresAt
        });

    const sessionId = newSession.insertedId;
    console.log(id, ip);

    // 2. Encrypt the session ID
    const session = await encrypt({ sessionId, expiresAt, userId: id, });

    const cookieStore = await cookies()
    cookieStore.set('session', session, {
        httpOnly: true,
        secure: true,
        expires: expiresAt,
        sameSite: 'lax',
        path: '/',
    });
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
                _id: session.sessionId,
            });
        return res;
    }
    return null;
}
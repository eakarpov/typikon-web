'use server';
import "server-only";
import clientPromise from "@/lib/mongodb";
import { SignJWT, jwtVerify } from 'jose';
import {cookies} from "next/headers";

const secretKey = process.env.SESSION_SECRET
const encodedKey = new TextEncoder().encode(secretKey)

export async function encrypt(payload: any) {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(encodedKey)
}

export async function decrypt(session: string | undefined = '') {
    try {
        const { payload } = await jwtVerify(session, encodedKey, {
            algorithms: ['HS256'],
        })
        return payload
    } catch (error) {
        console.log('Failed to verify session')
    }
}

export const createNewSession = async (id: string, state: any, ip: string, timestamp: number) => {
    const expiresAt = new Date(timestamp + state.expires_in);

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

    // 2. Encrypt the session ID
    const session = await encrypt({ sessionId, expiresAt, userId: id, });

    const cookieStore = await cookies()
    console.log(session, expiresAt);
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
    cookieStore.delete('session')
}

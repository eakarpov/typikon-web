import 'server-only'
import {cache} from 'react';
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/authorize/sessions';
import {NextApiRequest} from "next";
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {getUserByVKId} from "@/lib/authorize/users";

export const verifySession = cache(async () => {
    const cookie = (await cookies()).get('session')?.value;
    const session = await decrypt(cookie);

    if (session) {
        return { isAuth: true, userId: session.userId, expiresAt: session.expiresAt  };
    }

    // maybe here go to db, get vk refresh token and try to update the access one

    return { isAuth: false };
});

export const verifySessionBack = async (req: NextApiRequest, isAdmin?: boolean) => {
    const { session: token } = req.cookies;

    if (!token) return undefined;

    try {
        const session = await decrypt(token);

        if (!session) return undefined;

        const client = await clientPromise;
        const db = client.db("typikon-users");

        if (session) {
            const sessionExist = await db
                .collection("sessions")
                .findOne({
                    _id: new ObjectId(session.sessionId as string),
                });
            console.log(sessionExist);

            if (isAdmin) {
                let user = await getUserByVKId(session.userId as string);
                if (!user) return false;
                console.log(user);

                return user.isAdmin;
            }
            return true; // maybe also get user
        }
        return false;
    } catch (error) {
        console.log(error);
        return false;
    }
};
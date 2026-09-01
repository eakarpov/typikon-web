import 'server-only'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/authorize/sessions';
import {NextApiRequest} from "next";
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {getUserInfo} from "@/lib/authorize/users";
import { userCan, type Capability, type UserLike } from "@/lib/rights";

export const verifySession = async () => {
    const cookie = (await cookies()).get('session')?.value;
    const session = await decrypt(cookie);

    if (session) {
        return { isAuth: true, userId: session.userId, expiresAt: session.expiresAt  };
    }

    // maybe here go to db, get vk refresh token and try to update the access one

    return { isAuth: false, userId: undefined, expiresAt: 0 };
};

// Второй параметр значил «нужен админ». Теперь он называет ВОЗМОЖНОСТЬ, а
// `true` понимается по-прежнему — как «править содержимое»: так старые вызовы
// продолжают значить ровно то, что значили.
export const verifySessionBack = async (
    req: NextApiRequest, need?: boolean | Capability,
) => {
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

            if (!sessionExist) return false;

            if (need) {
                let user = await getUserInfo(sessionExist.id as string);
                if (!user) return false;

                return userCan(user as UserLike, need === true ? "content" : need);
            }
            return true; // maybe also get user
        }
        return false;
    } catch (error) {
        return false;
    }
};
import 'server-only'
import { getSession, getSessionFromToken } from '@/lib/authorize/sessions';
import {NextApiRequest} from "next";
import {getUserInfo} from "@/lib/authorize/users";
import {reportError} from "@/lib/reportError";
import { userCan, type Capability, type UserLike } from "@/lib/rights";

export const verifySession = async () => {
    const session = await getSession();
    if (session) {
        return { isAuth: true, userId: session.id, expiresAt: session.expiresAt };
    }

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
        const session = await getSessionFromToken(token);
        if (!session) return false;
        if (need) {
            const user = await getUserInfo(session.id);
            if (!user) return false;
            return userCan(user as UserLike, need === true ? "content" : need);
        }
        return true;
    } catch (error) {
        reportError(error, { where: "lib/authorize/authorization#verifySessionBack" });
        return false;
    }
};

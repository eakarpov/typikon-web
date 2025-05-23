import {NextApiRequest, NextApiResponse} from "next";
import {getUserByVKId, registerNewUserWithVK} from "@/lib/authorize/users";
import {createNewSession} from "@/lib/authorize/sessions";
import {cookies} from "next/headers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const body = req.body;
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        if (body.type === "VK") {
            let user = await getUserByVKId(body.data.user_id);
            if (!user) {
                // register
                await registerNewUserWithVK(body.data.user_id);
                user =  await getUserByVKId(body.data.user_id);
            }
            console.log(user);
            const { session, expiresAt } = await createNewSession(user!.id, body.data, ip as string, body.timestamp);
            // 3. Store the session in cookies for optimistic auth checks
            const cookieStore = await cookies()
            cookieStore.set('session', session, {
                httpOnly: true,
                secure: true,
                expires: expiresAt,
                sameSite: 'lax',
                path: '/',
            });
            res.status(200).end();
        } else {
            res.status(400).end();
        }
    }
};

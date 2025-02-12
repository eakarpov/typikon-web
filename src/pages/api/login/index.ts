import {NextApiRequest, NextApiResponse} from "next";
import {getUserByVKId, registerNewUserWithVK} from "@/lib/authorize/users";
import {createNewSession} from "@/lib/authorize/sessions";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const body = req.body;
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        if (body.type === "VK") {
            let user = await getUserByVKId(body.user_id);
            if (!user) {
                // register
                const new_id = await registerNewUserWithVK(body);
                user =  await getUserByVKId(new_id!);
            }
            await createNewSession(user!.id, body.data, ip as string, body.timestamp);
            res.send(200);
        } else {
            res.send(400);
        }
    }
};

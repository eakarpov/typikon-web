import {NextApiRequest, NextApiResponse} from "next";
import {decrypt, deleteSession} from "@/lib/authorize/sessions";
import {redirect} from "next/navigation";
import {cookies} from "next/headers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const cookieStore = await cookies()
        const cookie = cookieStore.get('session')?.value;
        const session = await decrypt(cookie);
        cookieStore.delete('session');
        await deleteSession(session)
        redirect('/login')
        res.send(200);
    } else {
        res.send(400);
    }
};

import {NextApiRequest, NextApiResponse} from "next";
import {deleteSession} from "@/lib/authorize/sessions";
import {redirect} from "next/navigation";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        await deleteSession()
        redirect('/login')
        res.send(200);
    } else {
        res.send(400);
    }
};

import {NextApiRequest, NextApiResponse} from "next";
import {getRandomProlog} from "@/app/api";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        const [item, error] = await getRandomProlog();
        if (error) {
            res.status(400);
            return;
        }
        res.status(200).json(item);
    }
}

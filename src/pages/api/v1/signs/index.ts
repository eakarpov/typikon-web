import {NextApiRequest, NextApiResponse} from "next";
import {getItems} from "@/app/signs/api";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        const months = await getItems();
        res.status(200).json(months);
    }
}

import {NextApiRequest, NextApiResponse} from "next";
import {getItems} from "@/app/triodion/api";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        const [weeks, error] = await getItems();
        if (error) {
            res.status(400);
            return;
        }
        res.status(200).json(weeks);
    }
}

import {NextApiRequest, NextApiResponse} from "next";
import getItems from "@/pages/api/v1/library/service";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        const [books, error] = await getItems();
        if (error) {
            res.status(400);
            return;
        }
        res.status(200).json(books);
    }
}

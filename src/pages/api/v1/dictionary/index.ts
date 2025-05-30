import {NextApiRequest, NextApiResponse} from "next";
import {searchData} from "@/app/dictionary/api";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        const search = req.query.query || "";
        const [texts, error] = await searchData((search as string).replace(/[^\u0400-\u04FF]/gi, ""));
        if (error) {
            res.status(400).end();
            return;
        }
        res.status(200).json(texts);
    }
}

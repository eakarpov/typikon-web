import {NextApiRequest, NextApiResponse} from "next";
import {searchData} from "@/app/dictionary/api";
import {rateLimit, DICTIONARY_LIMIT} from "@/lib/rateLimit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        if (!rateLimit(req, res, DICTIONARY_LIMIT)) return;

        const search = req.query.query || "";
        const [texts, error] = await searchData((search as string).replace(/[^\u0400-\u04FF]/gi, ""));
        if (error) {
            res.status(400).end();
            return;
        }
        res.status(200).json(texts);
    }
}

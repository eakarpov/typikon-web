import {NextApiRequest, NextApiResponse} from "next";
import {searchData} from "@/app/search/api";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        const search = req.query.query || "";
        // Прежний фильтр оставлял только кириллицу — вместе с пробелами, из-за чего запрос
        // из нескольких слов слипался в одно. Инъекции здесь и так невозможны ($text —
        // не регулярка), поэтому достаточно выкинуть управляющие символы и знаки.
        const cleaned = (search as string).replace(/[^\p{L}\p{N}\s-]/gu, " ");
        const [texts, error] = await searchData(cleaned);
        if (error) {
            res.status(400).end();
            return;
        }
        res.status(200).json(texts);
    }
}

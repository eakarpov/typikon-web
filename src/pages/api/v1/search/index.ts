import {NextApiRequest, NextApiResponse} from "next";
import {searchData} from "@/app/search/api";
import {rateLimit, SEARCH_LIMIT} from "@/lib/rateLimit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        // Полнотекстовый поиск идёт по 12,7 млн символов — ручка не из дешёвых,
        // и одному клиенту незачем занимать её целиком.
        if (!rateLimit(req, res, SEARCH_LIMIT)) return;

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

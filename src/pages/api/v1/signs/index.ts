import {NextApiRequest, NextApiResponse} from "next";
import {getItems} from "@/app/signs/api";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        const { page, q, month, sign, source } = req.query;
        const [result] = await getItems({
            page: page ? parseInt(page as string, 10) : undefined,
            q: q as string | undefined,
            month: month ? parseInt(month as string, 10) : undefined,
            sign: sign as string | undefined,
            source: source as string | undefined,
        });
        res.status(200).json(result);
    }
}

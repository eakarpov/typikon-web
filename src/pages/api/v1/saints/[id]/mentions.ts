import {NextApiRequest, NextApiResponse} from "next";
import {getMentions} from "@/app/saints/[id]/api";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        // Номер святцев. Выборка принимает их набор — у записи каталога их может быть
        // несколько (см. @/lib/saintSources); этот адрес отдаёт тексты одного номера.
        const id = req.query.id as string;
        if (!id) {
            res.status(400).end();
            return;
        }
        // v1 — прежний договор: святой номером святцев.
        const [texts, error] = await getMentions(null, [id]);
        if (error) {
            res.status(400).end();
            return;
        }
        res.status(200).json(texts);
    }
}
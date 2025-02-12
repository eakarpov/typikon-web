import {NextApiRequest, NextApiResponse} from "next";
import onSave from "@/lib/pdf/service";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const text = req.body as any;
        if (!text) {
            console.log("fallback")
            res.status(400).end();
            return;
        }
        try {
            const pdfBytes = await onSave(JSON.parse(text));
            const buffer = Buffer.from(pdfBytes);
            res.status(200).send(buffer);
        } catch (e) {
            console.log(e);
            res.status(400).end();
        }
    }
}
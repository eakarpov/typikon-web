import {NextApiRequest, NextApiResponse} from "next";
import onSave from "@/lib/pdf/service";
import {reportError} from "@/lib/reportError";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const text = req.body as any;
        if (!text) {
            res.status(400).end();
            return;
        }
        try {
            const pdfBytes = await onSave(JSON.parse(text));
            const buffer = Buffer.from(pdfBytes);
            res.status(200).send(buffer);
        } catch (e) {
            reportError(e, { where: "pages/api/v1/pdf", source: "api" });
            res.status(400).end();
        }
    }
}
import {NextApiRequest, NextApiResponse} from "next";
import {generateCaptcha} from "@/lib/captcha";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const buffer = await generateCaptcha(ip as string);
        return res.send(buffer);
    }
};

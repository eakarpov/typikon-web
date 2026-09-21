import {NextApiRequest, NextApiResponse} from "next";
import {generateCaptcha} from "@/lib/captcha";
import {CAPTCHA_LIMIT, clientIp, rateLimit} from "@/lib/rateLimit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        if (!rateLimit(req, res, CAPTCHA_LIMIT)) return;
        const buffer = await generateCaptcha(clientIp(req));
        return res.send(buffer);
    }
    res.status(404).end();
};

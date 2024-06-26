import path from "path";
import fs from "fs";
import {NextApiRequest, NextApiResponse} from "next";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== 'GET') {
        return res.status(405).end();
    }

    res.setHeader('Content-Disposition', 'attachment; filename=privacy-policy.pdf');
    res.setHeader('Content-Type', 'application/pdf');

    const filePath = path.join(process.cwd(), 'public', 'privacy-policy.pdf');
    const fileStream = fs.createReadStream(filePath);

    fileStream.pipe(res);

    res.on('finish', () => {
        fileStream.close();
    });
};

export default handler;
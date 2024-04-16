import {NextApiRequest, NextApiResponse} from "next";
import {writeMetaData} from "@/app/api";
import {getMeta} from "@/app/meta/api";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        getMeta().then((data) => {
            res.json(data);
        }).catch(() => {
            res.status(400);
        });
    } else {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        writeMetaData({
            ip,
            url: req.query?.source,
        }).then(() => {
            res.end();
        });
    }
};

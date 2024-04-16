import {NextApiRequest, NextApiResponse} from "next";
import {writeMetaData} from "@/app/api";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    writeMetaData({
       ip,
       url: req.query?.source,
    }).then(() => {
        res.end();
    });
};

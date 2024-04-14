import {NextApiRequest, NextApiResponse} from "next";
import {writeMetaData} from "@/app/api";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    console.log("heeere", req.url, req.query.source);
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    writeMetaData({
       ip,
       url: req.query?.source,
    });
    res.end();
};

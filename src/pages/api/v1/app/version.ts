import {NextApiRequest, NextApiResponse} from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        console.log("get method");
        res.status(200).json({ major: 0, minor: 2 });
    }
    console.log('not get method');
}
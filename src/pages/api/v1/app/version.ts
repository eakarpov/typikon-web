import {NextApiRequest, NextApiResponse} from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        console.log("get method");
        res.status(200).json({ major: 1, minor: 1 });
    }
    console.log('not get method');
}
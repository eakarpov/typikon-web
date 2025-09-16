import process from "node:process";
import {verifySessionBack} from "@/lib/authorize/authorization";
import {NextApiRequest, NextApiResponse} from "next";

export const checkRightsBack = async (req: NextApiRequest, res: NextApiResponse) => {
    if (process.env.NODE_ENV !== "development") {
        const hasSession = await verifySessionBack(req, true);
        if (!hasSession) {
            res.status(404).end();
        }
    }
}
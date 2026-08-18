import {NextApiRequest, NextApiResponse} from "next";
import {calcDay} from "@/lib/calcDay";
import {BIBLE_LANGUAGE_COOKIE, DEFAULT_BIBLE_LANGUAGE} from "@/utils/bibleLanguage";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const {date} = req.body;
        if (!date) {
            res.status(400).end();
            return;
        }

        const lang = (req.cookies?.[BIBLE_LANGUAGE_COOKIE] as string) || DEFAULT_BIBLE_LANGUAGE;

        try {
            const result = await calcDay(date, lang);
            if (!result) {
                res.status(404).end();
                return;
            }
            res.status(200).json(result);
        } catch (e) {
            res.status(500).end();
        }
    }
};

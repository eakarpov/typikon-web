import {NextApiRequest, NextApiResponse} from "next";
import {getItem} from "@/app/calendar/[id]/api";
import {BIBLE_LANGUAGE_COOKIE, DEFAULT_BIBLE_LANGUAGE} from "@/utils/bibleLanguage";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        const id = req.query.id as string;
        if (!id) {
            res.status(400).end();
            return;
        }
        const lang = (req.query.lang as string) || (req.cookies?.[BIBLE_LANGUAGE_COOKIE] as string) || DEFAULT_BIBLE_LANGUAGE;
        const [day, error] = await getItem(id, lang);
        if (error) {
            res.status(400).end();
            return;
        }
        res.status(200).json(day);
    }
}
import {NextApiRequest, NextApiResponse} from "next";
import {getItem} from "@/app/calendar/today/api";
import {BIBLE_LANGUAGE_COOKIE, DEFAULT_BIBLE_LANGUAGE} from "@/utils/bibleLanguage";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        const lang = (req.query.lang as string) || (req.cookies?.[BIBLE_LANGUAGE_COOKIE] as string) || DEFAULT_BIBLE_LANGUAGE;
        const [texts, error] = await getItem(lang, req.query.date as string | undefined);
        if (error) {
            res.status(400).end();
            return;
        }
        res.status(200).json(texts);
    }
}

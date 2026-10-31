import { AliasError, saveWithAlias } from "@/lib/contentAliases";
import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {checkRightsBack} from "@/lib/admin/back";
import {DEFAULT_BOOK_LANGUAGE} from "@/utils/bookLanguages";
import {reportError} from "@/lib/reportError";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method === 'POST') {
        if (!(await checkRightsBack(req, res))) return;
        const id = req.query.id as string;
        const data = req.body;
        if (!id) {
            res.status(400).end();
            return;
        }
        try {
            const client = await clientPromise;
            const db = client.db("typikon");
            await saveWithAlias(db, "books", id, data.alias, {
                name: data.name,
                description: data.description,
                translator: data.translator,
                updatedAt: new Date(),
                order: data.order,
                public: data.public,
                // Язык книги, а не издания Библии: bibleLanguageCode
                // выше — про резолюцию зачал и стоит лишь у двух книг.
                language: data.language || DEFAULT_BOOK_LANGUAGE,
            });
            res.status(200).end();
        } catch (e) {
            if (e instanceof AliasError) { res.status(e.status).json({ error: e.message }); return; }
            reportError(e, { where: "pages/api/admin/books/[id]#handler", source: "api" });
            res.status(500).json({ error: "Не удалось сохранить книгу" });
        }
    } else {
        res.status(404).end();
    }
}
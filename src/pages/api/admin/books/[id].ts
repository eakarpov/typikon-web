import { AliasError, saveWithAlias } from "@/lib/contentAliases";
import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {checkRightsBack} from "@/lib/admin/back";
import {DEFAULT_BOOK_LANGUAGE} from "@/utils/bookLanguages";
import {BOOK_CATEGORIES} from "@/utils/libraryBooks";
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
        const editionFields: { workKey?: string; editionTitle?: string; category?: string } = {};
        if (data.category !== undefined) {
            if (typeof data.category !== "string" || (data.category && !Object.hasOwn(BOOK_CATEGORIES, data.category))) {
                res.status(400).json({ error: "Неизвестная тематика книги" });
                return;
            }
            editionFields.category = data.category;
        }
        if (data.workKey !== undefined) {
            if (typeof data.workKey !== "string" || data.workKey.trim().length > 100
                || (data.workKey.trim() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.workKey.trim()))) {
                res.status(400).json({ error: "Ключ произведения: латинские строчные буквы, цифры и дефисы, до 100 символов" });
                return;
            }
            editionFields.workKey = data.workKey.trim();
        }
        if (data.editionTitle !== undefined) {
            if (typeof data.editionTitle !== "string" || data.editionTitle.trim().length > 200) {
                res.status(400).json({ error: "Название редакции должно быть строкой до 200 символов" });
                return;
            }
            editionFields.editionTitle = data.editionTitle.trim();
        }
        try {
            const client = await clientPromise;
            const db = client.db("typikon");
            await saveWithAlias(db, "books", id, data.alias, {
                ...editionFields,
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
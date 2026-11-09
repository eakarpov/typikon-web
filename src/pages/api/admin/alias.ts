import type { NextApiRequest, NextApiResponse } from "next";
import { ObjectId } from "mongodb";
import { checkRightsBack } from "@/lib/admin/back";
import clientPromise from "@/lib/mongodb";
import { aliasKeys } from "@/lib/contentAliases";
import { contentAliasBase } from "@/lib/contentAliasGeneration";
import { uniqueAlias } from "@/lib/news/format";
import { BOOK_CATEGORIES } from "@/utils/libraryBooks";
import { reportError } from "@/lib/reportError";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) return res.status(404).end();
    if (req.method !== "POST") return res.status(405).end();
    if (!(await checkRightsBack(req, res))) return;
    const { collection, id, name, category } = req.body ?? {};
    if ((collection !== "books" && collection !== "texts") || typeof id !== "string" || !ObjectId.isValid(id)
        || typeof name !== "string" || name.length > 2000
        || (category !== undefined && (typeof category !== "string" || (category && !Object.hasOwn(BOOK_CATEGORIES, category))))) {
        return res.status(400).json({ error: "Неверные данные для генерации адреса" });
    }
    try {
        const db = (await clientPromise).db("typikon");
        const doc = await db.collection(collection).findOne({ _id: new ObjectId(id) });
        if (!doc) return res.status(404).end();
        const book = collection === "books" ? doc : doc.bookId ? await db.collection("books").findOne({ _id: doc.bookId }) : null;
        const type = collection === "books" ? category ?? book?.category : book?.category;
        let base;
        try { base = contentAliasBase(name, type); }
        catch (error) { return res.status(400).json({ error: (error as Error).message }); }
        const docs = await db.collection(collection).find({ _id: { $ne: doc._id }, $or: [
            { alias: { $regex: `^${base}(?:-[0-9]+)?$` } }, { aliases: { $regex: `^${base}(?:-[0-9]+)?$` } },
        ] }, { projection: { alias: 1, aliases: 1 } }).toArray();
        const taken = new Set<string>(docs.flatMap(aliasKeys));
        if (collection === "texts") {
            taken.add("random");
            const bible = await db.collection("bible_books").find({}, { projection: { alias: 1 } }).toArray();
            bible.forEach(b => { if (b.alias) taken.add(b.alias); });
        }
        res.setHeader("Cache-Control", "no-store");
        return res.json({ alias: uniqueAlias(base, taken) });
    } catch (error) {
        reportError(error, { where: "admin/alias", source: "api" });
        return res.status(500).json({ error: "Не удалось сгенерировать адрес" });
    }
}

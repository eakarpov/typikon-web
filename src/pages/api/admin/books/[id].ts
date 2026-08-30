import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {checkRightsBack} from "@/lib/admin/back";
import {DEFAULT_BOOK_LANGUAGE} from "@/utils/bookLanguages";

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
        }
        try {
            const client = await clientPromise;
            const db = client.db("typikon");
            await db
                .collection("books")
                .updateOne(
                    { _id : new ObjectId(id) },
                    {
                        $set: {
                            name: data.name,
                            description: data.description,
                            translator: data.translator,
                            updatedAt: new Date(),
                            order: data.order,
                            public: data.public,
                            // Язык книги, а не издания Библии: bibleLanguageCode
                            // выше — про резолюцию зачал и стоит лишь у двух книг.
                            language: data.language || DEFAULT_BOOK_LANGUAGE,
                        },
                    },
                );
            res.status(200).end();
        } catch (e) {
            console.log("mongodb error");
        }
    } else {
        res.status(404).end();
    }
}
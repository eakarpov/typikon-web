import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {checkRightsBack} from "@/lib/admin/back";

// Один alias — один документ: адрес /texts/{alias} разрешается в один документ, и если
// alias занят, второй становится недостижим. В базе такие пары уже есть (следствие
// копирования при заведении), поэтому здесь хотя бы не даём заводить новые.
const aliasTaken = async (db: any, collection: string, alias: string, id: string) => {
    if (!alias) return false;
    const other = await db.collection(collection).findOne({ alias, _id: { $ne: new ObjectId(id) } });
    return Boolean(other);
};


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method === 'POST') {
        if (!(await checkRightsBack(req, res))) return;
        const data = req.body;
        const id = req.query.id as string;
        try {
            const client = await clientPromise;
            const db = client.db("typikon");
            if (await aliasTaken(db, "texts", data.alias, id)) {
                res.status(409).json({ error: `Alias «${data.alias}» уже занят другим документом` });
                return;
            }
            await db
                .collection("texts")
                .updateOne(
                    { "_id" : new ObjectId(id) },
                    {
                        $set: {
                            name: data.name,
                            footnotes: data.footnotes,
                            start: data.start,
                            description: data.description,
                            type: data.type,
                            bookIndex: parseInt(data.bookIndex, 10),
                            readiness: data.readiness,
                            textingPriority: data.textingPriority === "" || data.textingPriority == null
                                ? null
                                : parseInt(data.textingPriority, 10),
                            content: data.content,
                            updatedAt: new Date(),
                            ruLink: data.ruLink,
                            link: data.link,
                            translator: data.translator,
                            author: data.author,
                            alias: data.alias,
                            poems: data.poems,
                            images: data.images,
                            dneslovId: data.dneslovId,
                            dneslovEventId: data.dneslovEventId,
                            dneslovType: data.dneslovType,
                            initialPriestExclamation: data.initialPriestExclamation,
                            startPhrase: data.startPhrase,
                            mentionIds: data.mentionIds,
                            newUi: data.newUi,
                            info: data.info,
                            adminInfo: data.adminInfo,
                            quotes: data.quotes,
                            csSource: data.csSource, // Только маркер, паралелльно не сохраняем и то, и то
                            saintId: data.saintId,
                            contentType: data.contentType,
                            bibleBookSlug: data.bibleBookSlug,
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
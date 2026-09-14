import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {verifySession, verifySessionBack} from "@/lib/authorize/authorization";
import * as process from "node:process";
import {checkRightsBack} from "@/lib/admin/back";
import {reportError} from "@/lib/reportError";
import {namesWithSynonyms, toLocation} from "@/lib/places/legacy";

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
            const places = db.collection("places");
            const current = await places.findOne({ "_id": new ObjectId(id) }, { projection: { names: 1, locationSource: 1 } });
            // Новые поля выводятся из тех, что правит редактор (@/lib/places/legacy):
            // иначе точка на карте и имена разошлись бы с тем, что в нём видно.
            // Пустые широта и долгота у места, чья точка пришла из импорта, значат
            // «редактор точку не ставил», а не «убрать точку».
            const location = toLocation(data.latitude, data.longitude);
            const imported = current?.locationSource && current.locationSource !== "editor";
            await places
                .updateOne(
                    { "_id" : new ObjectId(id) },
                    {
                        $set: {
                            alias: data.alias,
                            updatedAt: new Date(),
                            name: data.name,
                            synonyms: data.synonyms,
                            names: namesWithSynonyms(current?.names, data.synonyms, data.name),
                            description: data.description,
                            links: data.links,
                            latitude: data.latitude,
                            longitude: data.longitude,
                            ...(location ? { location, locationSource: "editor" } : {}),
                        },
                        ...(location || imported ? {} : { $unset: { location: "", locationSource: "" } }),
                    },
                );

            res.status(200).end();
        } catch (e) {
            reportError(e, { where: "pages/api/admin/places/[id]#handler", source: "api" });
        }
    } else {
        res.status(404).end();
    }
}
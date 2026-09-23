import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {checkRightsBack} from "@/lib/admin/back";
import {buildSearchFields} from "@/lib/search";
import {normalizeParagraphs} from "@/utils/texts";
import {reportError} from "@/lib/reportError";
import {syncMarkupMentions} from "@/lib/places/markup";
import {saintIdOf} from "@/lib/saintKey";
import {syncTextSaintsOf} from "@/lib/textSaints";

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
            // Святой — ключом каталога. Поле принимает ссылку на страницу, адрес или
            // ключ; неузнанное не пишется вовсе, а не пишется мусором.
            const saintId = data.saintId ? await saintIdOf(data.saintId) : null;
            if (data.saintId && !saintId) {
                res.status(400).json({ error: `Святой «${data.saintId}» в каталоге не найден` });
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
                            // Граница абзаца — ровно два перевода строки: пробел между
                            // ними ломает разбиение и в вебе, и в приложении.
                            content: normalizeParagraphs(data.content),
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
                            saintId,
                            contentType: data.contentType,
                            // Нормализованные копии для поиска — иначе выдача отстаёт
                            // от правок до следующего прогона build-search-index.
                            ...buildSearchFields({ ...data, content: normalizeParagraphs(data.content) }),
                        },
                    },
                );

            // Пометки мест {pl|…} — в упоминания (@/lib/places/markup). Сбой здесь
            // не должен терять сохранённый текст: он уже записан, упоминания догонит
            // `npm run places:sync-markup`.
            try {
                await syncMarkupMentions(db, new ObjectId(id), normalizeParagraphs(data.content) ?? "");
            } catch (e) {
                reportError(e, { where: "pages/api/admin/texts/[id]/index#syncMarkupMentions", source: "api" });
            }

            // Ключи каталога сверяются с номерами святцев (@/lib/textSaints): святой,
            // заданный только номером, получает ключ, упоминания — свои ключи.
            try {
                await syncTextSaintsOf([id]);
            } catch (e) {
                reportError(e, { where: "pages/api/admin/texts/[id]/index#syncTextSaints", source: "api" });
            }

            res.status(200).end();
        } catch (e) {
            reportError(e, { where: "pages/api/admin/texts/[id]/index#handler", source: "api" });
        }
    } else {
        res.status(404).end();
    }
}
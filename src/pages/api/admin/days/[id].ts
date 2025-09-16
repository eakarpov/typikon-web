import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {checkRightsBack} from "@/lib/admin/back";

const mapToDbObject = (value: any) => {
  if (value?.items) {
      return {
          ...value,
          items: value.items.map((item: any) => ({
              ...item,
              textId: item.textId ? new ObjectId(item.textId) : null,
          })),
      }
  } return null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method === 'POST') {
        await checkRightsBack(req, res);
        const data = req.body;
        const id = req.query.id as string;
        try {
            const client = await clientPromise;
            const db = client.db("typikon");
            await db
                .collection("days")
                .updateOne(
                    { _id : new ObjectId(id) },
                    {
                        $set: {
                            paschal: data.paschal,
                            name: data.name,
                            weekIndex: data.weekIndex,
                            monthIndex: data.monthIndex,
                            alias: data.alias,
                            vespersProkimenon: mapToDbObject(data.vespersProkimenon),
                            vigil: mapToDbObject(data.vigil),
                            kathisma1: mapToDbObject(data.kathisma1),
                            kathisma2: mapToDbObject(data.kathisma2),
                            kathisma3: mapToDbObject(data.kathisma3),
                            before50: mapToDbObject(data.before50),
                            ipakoi: mapToDbObject(data.ipakoi),
                            polyeleos: mapToDbObject(data.polyeleos),
                            song3: mapToDbObject(data.song3),
                            song6: mapToDbObject(data.song6),
                            apolutikaTroparia: mapToDbObject(data.apolutikaTroparia),
                            before1h: mapToDbObject(data.before1h),
                            h1: mapToDbObject(data.h1),
                            h3: mapToDbObject(data.h3),
                            h6: mapToDbObject(data.h6),
                            h9: mapToDbObject(data.h9),
                            panagia: mapToDbObject(data.panagia),
                            updatedAt: new Date(),
                        },
                    },
                );
            res.status(200).end();
        } catch (e) {
            console.log("mongodb error", e);
            res.status(500).end();
        }
    } else {
        res.status(404).end();
    }
}
import { NextApiRequest, NextApiResponse } from 'next';
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { syncTextSaintsOf } from "@/lib/textSaints";
import { checkRightsBack } from "@/lib/admin/back";
import {reportError} from "@/lib/reportError";

// Переносит подтверждённые кандидаты в texts — то, что показывает /saints/[id]
// ("упоминается в чтениях", getMentions) и блок связей на странице чтения.
// Отклонённые и неразобранные не трогаются, поэтому кнопку можно жать сколько угодно раз.
//
// Пишем в три поля:
//   * mentionSaintIds — ключи каталога: по ним ищет сайт (@/lib/textSaints), и
//     только так упоминается святой нашего корпуса, у которого номера святцев нет;
//   * mentionIds — плоский список номеров святцев, на нём висят публичный API v2
//     и мобильное приложение; трогать его форму нельзя, номер пишется, если он есть;
//   * mentions — тот же список с найденным словом и фрагментом вокруг него.
//     Ровно ради этого фрагмента ревью и затевалось: список одних заголовков
//     читателю ничего не говорит, а строка "…наполньшися елисаветь разуме…" —
//     говорит. Раньше word/context доезжали до кандидата и там же пропадали.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).end();
        return;
    }
    if (!(await checkRightsBack(req, res))) return;

    try {
        const client = await clientPromise;
        const db = client.db("typikon");
        const collection = db.collection("mentionCandidates");

        const approved = await collection.find({ status: "approved" }).toArray();

        if (!approved.length) {
            res.status(200).json({ links: 0, texts: 0 });
            return;
        }

        // Номер святцев у записи каталога — для mentionIds; у святых корпуса его нет.
        const saintKeys = [...new Set(approved.map((c: any) => c.saintId).filter(Boolean))] as string[];
        const numberOf = new Map<string, string>();
        for (const s of await db.collection("saints").find(
            { _id: { $in: saintKeys.filter((k) => ObjectId.isValid(k)).map((k) => new ObjectId(k)) } },
            { projection: { externals: 1 } }).toArray()) {
            const n = ((s as any).externals ?? []).find((e: any) => e.source === "dneslov")?.id;
            if (n) numberOf.set(String(s._id), String(n));
        }

        const byText = new Map<string, { textId: any; mentions: Map<string, any> }>();
        for (const c of approved) {
            const key = c.textId.toString();
            const entry = byText.get(key) ?? { textId: c.textId, mentions: new Map<string, any>() };
            const saintId = c.saintId ? String(c.saintId) : null;
            const dneslovId = saintId ? numberOf.get(saintId) ?? null : (c.dneslovId ?? null);
            entry.mentions.set(saintId ?? `n:${dneslovId}`, {
                ...(saintId ? { saintId } : {}),
                ...(dneslovId ? { dneslovId } : {}),
                word: c.word ?? null,
                context: c.context ?? null,
            });
            byText.set(key, entry);
        }

        let links = 0;
        for (const [, entry] of byText) {
            const list = [...entry.mentions.values()];
            const keys = list.map((m) => m.saintId).filter(Boolean);
            const numbers = list.map((m) => m.dneslovId).filter(Boolean);

            // Сначала убираем прежние записи по этим же святым: пара текст/святой
            // должна остаться одна, даже если кандидата вернули в работу и одобрили заново.
            await db.collection("texts").updateOne(
                { _id: entry.textId },
                { $pull: { mentions: { $or: [{ saintId: { $in: keys } }, { dneslovId: { $in: numbers } }] } } } as any,
            );
            await db.collection("texts").updateOne(
                { _id: entry.textId },
                {
                    // Пустой список не заводим: у святого корпуса номера нет, и
                    // пустой mentionIds значил бы для API «упоминаний нет».
                    $addToSet: {
                        ...(keys.length ? { mentionSaintIds: { $each: keys } } : {}),
                        ...(numbers.length ? { mentionIds: { $each: numbers } } : {}),
                    },
                    $push: { mentions: { $each: list } },
                } as any,
            );
            links += list.length;
        }

        // Ключи каталога у упоминаний — по номерам (@/lib/textSaints).
        await syncTextSaintsOf([...byText.values()].map((e) => e.textId));

        await collection.updateMany(
            { status: "approved" },
            { $set: { status: "applied", appliedAt: new Date() } },
        );

        res.status(200).json({ links, texts: byText.size });
    } catch (e) {
        reportError(e, { where: "pages/api/admin/mentions/apply#handler", source: "api" });
        res.status(500).end();
    }
}

// npm run db:text-links [-- --apply]. Default: report only; --apply backs up fields first.
import "@/scripts/lib/env";
import { MongoClient } from "mongodb";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { textLinks } from "@/lib/textLinks";
import { revalidateContent } from "@/scripts/lib/revalidate";

async function main() {
    const client = await new MongoClient(process.env.MONGODB_URI!).connect();
    try {
        const collection = client.db("typikon").collection("texts");
        const rows = await collection.find({}, { projection: { link: 1, ruLink: 1 } }).toArray();
        const plan = rows.map(doc => {
            const fields: Record<string, string[]> = {};
            for (const key of ["link", "ruLink"] as const) {
                const value = doc[key];
                if (value != null && typeof value !== "string" && (!Array.isArray(value) || !value.every(v => typeof v === "string"))) {
                    throw new Error(`Неизвестный формат ${key} у ${doc._id}; перенос остановлен`);
                }
                const normalized = textLinks(value);
                if (JSON.stringify(value) !== JSON.stringify(normalized)) fields[key] = normalized;
            }
            return { doc, fields };
        }).filter(row => Object.keys(row.fields).length);
        console.log(JSON.stringify({ mode: process.argv.includes("--apply") ? "apply" : "plan", documents: plan.length, total: rows.length }));
        if (!process.argv.includes("--apply") || !plan.length) return;
        const dir = join(process.cwd(), "scratch", "text-links-backups");
        await mkdir(dir, { recursive: true });
        const backup = join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
        await writeFile(backup, JSON.stringify(plan.map(({ doc, fields }) => ({ id: String(doc._id), before: { link: doc.link, ruLink: doc.ruLink }, after: fields })), null, 2), { flag: "wx", mode: 0o600 });
        console.log(`Резервная копия: ${backup}`);
        const ops = plan.map(({ doc, fields }) => ({ updateOne: {
            filter: { _id: doc._id, ...Object.fromEntries(Object.keys(fields).map(key => [key, Object.hasOwn(doc, key) ? { $eq: doc[key] } : { $exists: false }])) },
            update: { $set: fields },
        } }));
        const result = await collection.bulkWrite(ops, { ordered: false });
        console.log(`Обновлено: ${result.modifiedCount}`);
        if (result.matchedCount !== plan.length) throw new Error("Часть ссылок изменена параллельно; повторите перенос для оставшихся записей");
        await revalidateContent();
    } finally { await client.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

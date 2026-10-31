// По умолчанию только план. --apply: резервная копия метаданных, индексы, адреса.
// Окружение должно указывать на локальную базу корпуса; на сервере не запускать.
import "@/scripts/lib/env";
import { MongoClient, type Document } from "mongodb";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { aliasKeys, aliasPatch, ALIAS_KEYS_INDEX, type AliasCollection } from "@/lib/contentAliases";
import { slugify, uniqueAlias } from "@/lib/news/format";
import { revalidateContent } from "@/scripts/lib/revalidate";

const apply = process.argv.includes("--apply");
const client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 5000 });
// Короткие адреса для длинных заголовков; остальные выводятся из названий.
const preferred: Record<string, string> = {
    "695ad885d095cc428a7432c3": "dobrotolyubie",
    "6982f221b97a02b4f5b62110": "kniga-pravil",
    "63f4f2d43f71d33cda1d9f3b": "pouchenie-na-pyatidesyatnicu",
    "63f512ea3f71d33cda1d9f45": "pouchenie-na-blagoveschenie-slovo-71",
    "63f514093f71d33cda1d9f46": "pouchenie-georgiyu-slovo-72",
    "65440d0e72949a78b5383142": "muchenie-i-pohvala-iakova-brata-gospodnya-dubl",
    "692716872bbf51ebb1dbed92": "zlatoust-o-polze-umershim-poslanie-k-filippiycam",
};

async function main() {
    // Из локального рабочего процесса не подключаемся к удалённой MongoDB.
    const host = new URL(process.env.MONGODB_URI!).hostname;
    if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) throw new Error("Миграция разрешена только для локальной MongoDB");
    await client.connect();
    const db = client.db("typikon");
    const plan: { collection: AliasCollection; doc: Document; alias: string; aliases: string[]; changed: boolean }[] = [];
    for (const name of ["books", "texts"] as const) {
        const docs = await db.collection(name).find({}, { projection: {
            name: 1, alias: 1, aliases: 1, content: 1, updatedAt: 1,
        } }).sort({ _id: 1 }).toArray();
        const occupied = new Set<string>();
        if (name === "texts") {
            occupied.add("random");
            const biblical = await db.collection("bible_books").find({}, { projection: { alias: 1 } }).toArray();
            for (const b of biblical) if (b.alias) occupied.add(b.alias);
        }
        const owners = new Map<string, string>();
        for (const doc of docs) for (const address of aliasKeys(doc)) {
            if (occupied.has(address) && !owners.has(address)) throw new Error(`Адрес ${address} занят библейской/служебной записью`);
            if (owners.has(address) && owners.get(address) !== String(doc._id)) throw new Error(`Повтор адреса ${address} в ${name}`);
            owners.set(address, String(doc._id));
            occupied.add(address);
        }
        for (const doc of docs) {
            // Существующие адреса не переименовываются. Пустые заготовки не получают случайных адресов.
            const assign = !doc.alias && (name === "books" || typeof doc.content === "string" && doc.content.trim());
            if (assign && !doc.name?.trim()) throw new Error(`Нет названия у ${name}/${doc._id}; нужен адрес редактора`);
            const alias = assign ? uniqueAlias(preferred[String(doc._id)] ??
                slugify(String(doc.name).normalize("NFC").replace(/[\u0300\u0301]/g, "")), occupied)
                : doc.alias || "";
            if (assign) occupied.add(alias);
            const patch = aliasPatch(doc, alias);
            if (!patch.aliases.length) continue;
            const changed = alias !== (doc.alias || "");
            if (changed || JSON.stringify(doc.aliases) !== JSON.stringify(patch.aliases)) {
                plan.push({ collection: name, doc, ...patch, changed });
            }
        }
    }
    const addresses = plan.filter(p => p.changed).map(p => ({
        collection: p.collection, id: String(p.doc._id), name: p.doc.name, alias: p.alias,
    }));
    console.log(JSON.stringify({ mode: apply ? "apply" : "plan", newAddresses: addresses,
        seedHistory: plan.filter(p => !p.changed).length }, null, 2));
    if (!apply || !plan.length) return;
    const backupDir = join(process.cwd(), "scratch", "alias-backups");
    await mkdir(backupDir, { recursive: true });
    const backupPath = join(backupDir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await writeFile(backupPath, JSON.stringify(plan.map(({ collection, doc, alias, aliases }) => ({
        collection, id: String(doc._id), before: {
            ...(doc.alias !== undefined ? { alias: doc.alias } : {}),
            ...(doc.aliases !== undefined ? { aliases: doc.aliases } : {}),
            ...(doc.updatedAt !== undefined ? { updatedAt: doc.updatedAt } : {}),
        }, after: { alias, aliases },
    })), null, 2), { flag: "wx", mode: 0o600 });
    console.log(`Резервная копия метаданных: ${backupPath}`);
    for (const name of ["books", "texts"] as const) {
        await db.collection(name).createIndex({ alias: 1 }, { unique: true, partialFilterExpression: { alias: { $gt: "" } } });
        await db.collection(name).createIndex({ aliases: 1 }, ALIAS_KEYS_INDEX);
        for (const p of plan.filter(p => p.collection === name)) {
            const result = await db.collection(name).updateOne({
                _id: p.doc._id,
                alias: p.doc.alias === undefined ? { $exists: false } : p.doc.alias,
                aliases: p.doc.aliases === undefined ? { $exists: false } : p.doc.aliases,
            }, { $set: { aliases: p.aliases, ...(p.changed ? { alias: p.alias, updatedAt: new Date() } : {}) } });
            if (!result.matchedCount) throw new Error(`Параллельная правка ${name}/${p.doc._id}; остановка. Повтор безопасен.`);
        }
    }
    console.log(`Назначено адресов: ${addresses.length}; история зарезервирована у ${plan.length} записей.`);
    await revalidateContent();
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
    .finally(() => client.close());

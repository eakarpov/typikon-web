// Только локальный корпус. По умолчанию план, --apply — копия и точечная правка.
import "@/scripts/lib/env";
import { BSON, MongoClient, ObjectId, type Document } from "mongodb";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { TextType } from "@/utils/texts";
import { revalidateContent } from "@/scripts/lib/revalidate";

const apply = process.argv.includes("--apply");
const client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 5000 });
const equal = (a: unknown, b: unknown) => BSON.EJSON.stringify(a) === BSON.EJSON.stringify(b);
const continuousReading = {
    bookSlug: "deyaniya", fromChapter: 1,
    sourceUrl: "https://azbyka.ru/otechnik/Pravoslavnoe_Bogosluzhenie/tipikon/50",
};

async function main() {
    if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.MONGODB_URI!).hostname)) {
        throw new Error("Допускается только локальная MongoDB");
    }
    await client.connect();
    const db = client.db("typikon");
    const anti = await db.collection("days").findOne({ alias: "antipascha" });
    const pascha = await db.collection("days").findOne({ alias: "pascha" });
    const old = await db.collection("days").findOne({ alias: "strastnaja-nedelja" });
    const post = await db.collection("weeks").findOne({ alias: "post-1" });
    const holy = await db.collection("weeks").findOne({ alias: "strastnaja" });
    if (!anti || !pascha || !old || !post || !holy) throw new Error("Не найдены ожидаемые дни/седмицы");
    const first = anti.vigil?.items?.[0];
    if (!first || first.textId || first.pericopeId || !/деяний/iu.test((first.cite ?? "").replace(/\u0301/g, ""))) {
        throw new Error("Назначение Антипасхи изменилось; нужна новая сверка");
    }
    const broken = new ObjectId("69a4a2d23675784b029b080b");
    if (await db.collection("days").findOne({ _id: broken })) throw new Error("Прежде отсутствовавший день теперь существует");
    // Не скрываем ни одного самостоятельного чтения, которого нет в основной Пасхе.
    for (const slot of Object.values(TextType)) for (const item of old[slot]?.items ?? []) {
        if (!(pascha[slot]?.items ?? []).some((p: Document) => equal(p, item))) {
            throw new Error(`У второй Пасхи есть отдельное назначение ${slot}; объединение остановлено`);
        }
    }
    const plans: { collection: string; before: Document; fields: Document }[] = [
        { collection: "days", before: anti, fields: { vigil: { ...anti.vigil,
            items: [{ ...first, continuousReading }, ...anti.vigil.items.slice(1)] } } },
        { collection: "weeks", before: post, fields: { days: post.days.filter((id: ObjectId) => !id.equals(broken)) } },
        { collection: "weeks", before: holy, fields: { days: holy.days.filter((id: ObjectId) => !id.equals(old._id)) } },
        { collection: "days", before: old, fields: { redirectTo: pascha._id, weekId: null, weekIndex: null } },
    ];
    const changes = plans.filter(p => Object.entries(p.fields).some(([k, value]) => !equal(p.before[k], value)));
    console.log(JSON.stringify({ mode: apply ? "apply" : "plan", changes: changes.map(p => ({
        collection: p.collection, id: String(p.before._id), alias: p.before.alias, fields: Object.keys(p.fields),
    })) }, null, 2));
    if (!apply || !changes.length) return;
    const dir = join(process.cwd(), "scratch", "triodion-backups");
    await mkdir(dir, { recursive: true });
    const path = join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await writeFile(path, BSON.EJSON.stringify(changes, undefined, 2), { flag: "wx", mode: 0o600 });
    console.log(`Копия исходных документов: ${path}`);
    for (const plan of changes) {
        const filter: Document = { _id: plan.before._id };
        for (const field of Object.keys(plan.fields)) filter[field] = plan.before[field] === undefined
            ? { $exists: false } : plan.before[field];
        const result = await db.collection(plan.collection).updateOne(filter,
            { $set: { ...plan.fields, updatedAt: new Date() } });
        if (!result.matchedCount) throw new Error(`Параллельная правка ${plan.before.alias}; миграция остановлена`);
    }
    console.log(`Изменено документов: ${changes.length}. Повторный запуск безопасен.`);
    await revalidateContent();
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
    .finally(() => client.close());

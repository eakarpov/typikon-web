// Только местная база. Без --apply — план; применение сохраняет BSON-копию дней.
import "@/scripts/lib/env";
import { BSON, MongoClient, ObjectId, type Document } from "mongodb";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { continuousReading } from "@/lib/continuousReading";
import { revalidateContent } from "@/scripts/lib/revalidate";

const apply = process.argv.includes("--apply");
const client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 5000 });
const local = (url: string) => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
const equal = (a: unknown, b: unknown) => BSON.EJSON.stringify(a) === BSON.EJSON.stringify(b);
const sourceUrl = "https://azbyka.ru/otechnik/Pravoslavnoe_Bogosluzhenie/tipikon/50";
const targets = [
    ["63d16fa3bec689206fc697d8", "Неделя мироносиц"],
    ["63d17058bec689206fc697df", "Неделя о расслабленном"],
    ["63d170c2bec689206fc697e6", "Неделя о самаряныни"],
    ["63d17171bec689206fc697ed", "Неделя о слепом"],
    ["63d17172bec689206fc697f1", "Вознесение Господне"],
    ["63d171cfbec689206fc697f4", "Неделя святых отец собора иже в Никеи"],
    ["63d17229bec689206fc697fb", "Пятидесятница"],
    ["63d1724cbec689206fc69802", "Неделя всех святых"],
] as const;

async function main() {
    if (!local(process.env.MONGODB_URI!)) throw new Error("Допускается только локальная MongoDB");
    await client.connect();
    const db = client.db("typikon");
    const changes: { before: Document; vigil: Document }[] = [];
    for (const [id, name] of targets) {
        const before = await db.collection("days").findOne({ _id: new ObjectId(id) });
        if (!before || before.name !== name || before.redirectTo) throw new Error(`День изменился: ${id}`);
        const james = id === "63d1724cbec689206fc69802";
        const reading = continuousReading({ bookSlug: james ? "iakova" : "deyaniya",
            ...(james ? { fromChapter: 1 } : {}), sourceUrl });
        if (!reading) throw new Error(`Не распознана книга ${id}`);
        const items = before.vigil?.items ?? [];
        if (!Array.isArray(items)) throw new Error(`Неверная структура бдения ${id}`);
        if (items.length === 1 && equal(items[0].continuousReading, reading)
            && !items[0].textId && !items[0].pericopeId) continue;
        if (items.length) throw new Error(`Бдение ${name} уже содержит другое назначение; нужна сверка`);
        changes.push({ before, vigil: { ...before.vigil, items: [{
            paschal: true,
            description: james ? "Великое чтение: послание Иакова с начала"
                : "Великое чтение: продолжение Деяний",
            cite: james
                ? `${sourceUrl} — Неделя всех святых: по благословении хлебов чтение послания соборного Иаковля; от этой недели начинается чтение посланий.`
                : `${sourceUrl}; Типикон, гл. 2: в пасхальный период по благословении хлебов читаются Деяния. Выбранный вариант — последовательное продолжение перед шестопсалмием; границы отдельного фрагмента не заданы.`,
            continuousReading: reading,
        }] } });
    }
    console.log(JSON.stringify({ mode: apply ? "apply" : "plan", changes: changes.map(p => ({
        id: String(p.before._id), name: p.before.name, reading: p.vigil.items[0].continuousReading,
    })) }, null, 2));
    if (!apply || !changes.length) return;
    const dir = join(process.cwd(), "scratch", "triodion-backups");
    await mkdir(dir, { recursive: true });
    const path = join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}-vigils.json`);
    await writeFile(path, BSON.EJSON.stringify(changes, undefined, 2), { flag: "wx", mode: 0o600 });
    console.log(`Копия исходных документов: ${path}`);
    for (const { before, vigil } of changes) {
        const result = await db.collection("days").updateOne({ _id: before._id,
            vigil: before.vigil === undefined ? { $exists: false } : before.vigil,
        }, { $set: { vigil, updatedAt: new Date() } });
        if (!result.matchedCount) throw new Error(`Параллельная правка ${before.name}; миграция остановлена`);
    }
    console.log(`Добавлено великих чтений: ${changes.length}. Повтор безопасен.`);
    if (local(process.env.REVALIDATE_URL || "http://localhost:3000")) await revalidateContent();
    else console.warn("Удалённый сброс кэша пропущен: разрешён только локальный сайт.");
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
    .finally(() => client.close());

// Только местная база. План по умолчанию, --apply сохраняет копию и заменяет 9 фрагментов 6 чтениями.
import "@/scripts/lib/env";
import { BSON, MongoClient, ObjectId, type Document } from "mongodb";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import readings from "@/scripts/data/composite-paremias.json";
import { BIBLE_CANON } from "@/utils/bibleCanon";
import { resolvePericopeVersesWithFallback } from "@/lib/pericopes";
import { revalidateContent } from "@/scripts/lib/revalidate";

const apply = process.argv.includes("--apply");
const client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 5000 });
const local = (url: string) => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
const equal = (a: unknown, b: unknown) => BSON.EJSON.stringify(a) === BSON.EJSON.stringify(b);
const targets = [
    { id: "63d17059bec689206fc697e2", name: "Преполовение Пятидесятницы", old: [
        "6a82df6e945cae9d99e6c6fc", "6a82df6e945cae9d99e6c6fd", "6a82df6e945cae9d99e6c6fe",
        "6a82df6e945cae9d99e6c6ff", "6a82df6e945cae9d99e6c700",
    ] },
    { id: "63d17172bec689206fc697f1", name: "Вознесение Господне", old: [
        "6a82df6e945cae9d99e6c701", "6a82df6e945cae9d99e6c702", "6a82df6e945cae9d99e6c703", "6a82df6e945cae9d99e6c704",
    ] },
];

async function main() {
    if (!local(process.env.MONGODB_URI!)) throw new Error("Допускается только локальная MongoDB");
    await client.connect();
    const db = client.db("typikon");
    const pericopes: Document[] = [];
    const days: { before: Document; vespersProkimenon: Document }[] = [];
    for (const r of readings) {
        if (!BIBLE_CANON.some(b => b.id === r.bookSlug)
            || createHash("sha256").update(r.liturgicalText.content).digest("hex") !== r.contentSha256) {
            throw new Error(`Повреждён проверенный текст ${r.key}`);
        }
        const expected: Document = { _id: new ObjectId(r.id), source: "paremia", bookSlug: r.bookSlug,
            label: r.label, ranges: r.ranges, liturgicalText: r.liturgicalText,
            liturgicalSourceUrl: r.liturgicalSourceUrl, compositeTriodionKey: r.key,
            occasions: [targets.find(t => t.id === r.dayId)!.name],
        };
        const existing = await db.collection("pericopes").findOne({ _id: expected._id });
        if (existing) {
            if (Object.entries(expected).some(([k, v]) => !equal(existing[k], v))) {
                throw new Error(`Изменилось отдельное богослужебное чтение ${r.key}`);
            }
        } else pericopes.push(expected);
        const resolved = await resolvePericopeVersesWithFallback(db, expected, "cs");
        if (resolved?.liturgicalText?.content !== r.liturgicalText.content || resolved.verses.length) {
            throw new Error(`Не разрешается точная редакция ${r.key}`);
        }
    }
    for (const target of targets) {
        const before = await db.collection("days").findOne({ _id: new ObjectId(target.id) });
        if (!before || before.name !== target.name || before.redirectTo) throw new Error(`День изменился: ${target.id}`);
        const items = readings.filter(r => r.dayId === target.id).sort((a, b) => a.order - b.order).map(r => ({
            pericopeId: new ObjectId(r.id), textId: null, paschal: false,
            description: `Паремия ${r.order}. ${r.sourceHeading}`, cite: r.liturgicalSourceUrl,
        }));
        if (equal(before.vespersProkimenon?.items, items)) continue;
        if (!equal(before.vespersProkimenon?.items?.map((i: Document) => String(i.pericopeId)), target.old)
            || before.vespersProkimenon.items.some((i: Document) => i.textId)) {
            throw new Error(`Назначения ${target.name} изменились; нужна новая сверка`);
        }
        days.push({ before, vespersProkimenon: { ...before.vespersProkimenon, items } });
    }
    console.log(JSON.stringify({ mode: apply ? "apply" : "plan", newPericopes: pericopes.length,
        days: days.map(p => ({ name: p.before.name, before: p.before.vespersProkimenon.items.length, after: 3 })) }, null, 2));
    if (!apply || (!pericopes.length && !days.length)) return;
    const dir = join(process.cwd(), "scratch", "triodion-backups");
    await mkdir(dir, { recursive: true });
    const path = join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}-composite-paremias.json`);
    // Полные прежние дни и каталоговые документы: старые ID не удаляются и не правятся.
    const previous = await db.collection("pericopes").find({ _id: { $in: targets.flatMap(t => t.old.map(id => new ObjectId(id))) } }).toArray();
    await writeFile(path, BSON.EJSON.stringify({ days, previous, newPericopes: pericopes }, undefined, 2), { flag: "wx", mode: 0o600 });
    console.log(`Копия исходных документов: ${path}`);
    for (const p of pericopes) await db.collection("pericopes").insertOne({ ...p, updatedAt: new Date() });
    for (const p of days) {
        const result = await db.collection("days").updateOne({ _id: p.before._id, vespersProkimenon: p.before.vespersProkimenon },
            { $set: { vespersProkimenon: p.vespersProkimenon, updatedAt: new Date() } });
        if (!result.matchedCount) throw new Error(`Параллельная правка ${p.before.name}; миграция остановлена`);
    }
    console.log(`Создано отдельных чтений: ${pericopes.length}; обновлено дней: ${days.length}. Повтор безопасен.`);
    if (local(process.env.REVALIDATE_URL || "http://localhost:3000")) await revalidateContent();
    else console.warn("Удалённый сброс кэша пропущен: разрешён только локальный сайт.");
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
    .finally(() => client.close());

// Только местный корпус. План по умолчанию; --apply сохраняет BSON-копию и добавляет 6 паремий.
import "@/scripts/lib/env";
import { BSON, MongoClient, ObjectId, type Document } from "mongodb";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import readings from "@/scripts/data/pentecostarion-paremias.json";
import { resolvePericopeVersesWithFallback } from "@/lib/pericopes";
import { revalidateContent } from "@/scripts/lib/revalidate";

const apply = process.argv.includes("--apply");
const client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 5000 });
const local = (url: string) => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
const equal = (a: unknown, b: unknown) => BSON.EJSON.stringify(a) === BSON.EJSON.stringify(b);

async function main() {
    if (!local(process.env.MONGODB_URI!)) throw new Error("Допускается только локальная MongoDB");
    await client.connect();
    const db = client.db("typikon");
    const pericopes: { before: null; after: Document }[] = [];
    const days: { before: Document; vespersProkimenon: Document }[] = [];
    const targets = new Map([
        ["63d171cfbec689206fc697f4", "Неделя святых отец собора иже в Никеи"],
        ["63d1724cbec689206fc69802", "Неделя всех святых"],
    ]);
    for (const reading of readings) {
        const expected: Document = { _id: new ObjectId(reading.id), source: "paremia",
            bookSlug: reading.bookSlug, label: reading.label, ranges: reading.ranges,
            occasions: [targets.get(reading.dayId)], pentecostarionAuditKey: reading.key,
            liturgicalSourceUrl: reading.liturgicalSourceUrl,
            ...(reading.liturgicalEnding ? { liturgicalEnding: reading.liturgicalEnding } : {}),
        };
        const existing = await db.collection("pericopes").findOne({ _id: expected._id });
        if (existing) {
            if (Object.entries(expected).some(([k, v]) => !equal(existing[k], v))) {
                throw new Error(`Изменилось зачало ${reading.label}; нужна сверка`);
            }
        } else pericopes.push({ before: null, after: expected });
        const resolved = await resolvePericopeVersesWithFallback(db, expected, "cs");
        if (!resolved || resolved.verses.length !== reading.expectedVerses) {
            throw new Error(`Не собрано полностью ${reading.label}`);
        }
        if (reading.liturgicalEnding && !resolved.verses.at(-1)?.content.endsWith(reading.liturgicalEnding.endAfter)) {
            throw new Error(`Не совпало окончание ${reading.label}`);
        }
    }
    for (const [id, name] of targets) {
        const before = await db.collection("days").findOne({ _id: new ObjectId(id) });
        if (!before || before.name !== name || before.redirectTo) throw new Error(`День изменился: ${id}`);
        const expectedItems = readings.filter(r => r.dayId === id).sort((a, b) => a.order - b.order)
            .map(r => ({ cite: r.liturgicalSourceUrl, description: `Паремия ${r.order}. ${r.sourceHeading}`,
                paschal: false, textId: null, pericopeId: new ObjectId(r.id) }));
        if (equal(before.vespersProkimenon?.items, expectedItems)) continue;
        const items = before.vespersProkimenon?.items ?? [];
        if (!Array.isArray(items) || items.length) throw new Error(`У ${name} уже есть другие паремии; нужна сверка`);
        days.push({ before, vespersProkimenon: { ...before.vespersProkimenon, items: expectedItems } });
    }
    console.log(JSON.stringify({ mode: apply ? "apply" : "plan", newPericopes: pericopes.length,
        days: days.map(p => ({ id: String(p.before._id), name: p.before.name })),
        readings: readings.map(r => ({ label: r.label, verses: r.expectedVerses, partialLastVerse: Boolean(r.liturgicalEnding) })),
    }, null, 2));
    if (!apply || (!pericopes.length && !days.length)) return;
    const dir = join(process.cwd(), "scratch", "triodion-backups");
    await mkdir(dir, { recursive: true });
    const path = join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}-paremias.json`);
    await writeFile(path, BSON.EJSON.stringify({ days, pericopes }, undefined, 2), { flag: "wx", mode: 0o600 });
    console.log(`Копия исходных документов и новых зачал: ${path}`);
    for (const p of pericopes) await db.collection("pericopes").insertOne({ ...p.after, updatedAt: new Date() });
    for (const p of days) {
        const result = await db.collection("days").updateOne({ _id: p.before._id,
            vespersProkimenon: p.before.vespersProkimenon === undefined ? { $exists: false } : p.before.vespersProkimenon,
        }, { $set: { vespersProkimenon: p.vespersProkimenon, updatedAt: new Date() } });
        if (!result.matchedCount) throw new Error(`Параллельная правка ${p.before.name}; миграция остановлена`);
    }
    console.log(`Создано зачал: ${pericopes.length}; обновлено дней: ${days.length}. Повтор безопасен.`);
    if (local(process.env.REVALIDATE_URL || "http://localhost:3000")) await revalidateContent();
    else console.warn("Удалённый сброс кэша пропущен: разрешён только локальный сайт.");
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
    .finally(() => client.close());

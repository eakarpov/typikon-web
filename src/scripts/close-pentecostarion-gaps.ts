// Только местная база: план по умолчанию, --apply сохраняет копию и закрывает два места чтения.
import "@/scripts/lib/env";
import { BSON, MongoClient, ObjectId, type Document } from "mongodb";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolvePericopeVersesWithFallback } from "@/lib/pericopes";
import { revalidateContent } from "@/scripts/lib/revalidate";

const apply = process.argv.includes("--apply");
const client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 5000 });
const local = (url: string) => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
const equal = (a: unknown, b: unknown) => BSON.EJSON.stringify(a) === BSON.EJSON.stringify(b);
const textId = new ObjectId("68e77afb42faa8ee591f64a7");
const gospelId = new ObjectId("6a820cb93f7812bfa7c4f603");

async function main() {
    if (!local(process.env.MONGODB_URI!)) throw new Error("Допускается только локальная MongoDB");
    await client.connect();
    const db = client.db("typikon");
    const text = await db.collection("texts").findOne({ _id: textId });
    if (!text || String(text.bookId) !== "63f515d308f7ee04e7b53f19" || text.readiness !== "ready"
        || createHash("sha256").update(text.content ?? "").digest("hex") !==
            "787616bcb92e902705a5e6f33f357c87ed6a9ce64a99443c527f1cb7cf33b6f6") {
        throw new Error("Изменился проверенный фрагмент Торжественника на 1 Кор.; нужна сверка");
    }
    const gospel = await db.collection("pericopes").findOne({ _id: gospelId });
    if (!gospel || gospel.bookSlug !== "ioanna" || gospel.number !== 65 || gospel.variant !== "Б"
        || !equal(gospel.ranges, [{ chapterFrom: 20, verseFrom: 19, chapterTo: 20, verseTo: 25 }])) {
        throw new Error("Не найдено ожидаемое Ин.65Б, 20:19–25");
    }
    const resolved = await resolvePericopeVersesWithFallback(db, gospel, "cs");
    if (resolved?.verses.length !== 7) throw new Error("Не разрешается пасхальное Евангелие");
    const pascha = await db.collection("days").findOne({ _id: new ObjectId("63c96246e99d9f4d9010c596") });
    const memorial = await db.collection("days").findOne({ _id: new ObjectId("63d171d3bec689206fc697fa") });
    if (!pascha || !memorial || pascha.name !== "Пасха" || pascha.redirectTo || memorial.redirectTo) {
        throw new Error("Не найдены ожидаемые самостоятельные дни");
    }
    const changes: { before: Document; fields: Document }[] = [];
    const gItems = pascha.gospelVespers?.items ?? [];
    if (!Array.isArray(gItems)) throw new Error("Неверная структура Евангелия вечерни");
    if (!gItems.length) changes.push({ before: pascha, fields: { gospelVespers: {
        ...pascha.gospelVespers, items: [{ pericopeId: gospelId, textId: null, paschal: false,
            description: "Ин.65Б, 20:19–25. Великая вечерня в самый день Пасхи",
            cite: "https://azbyka.ru/otechnik/Pravoslavnoe_Bogosluzhenie/tipikon/50 — Пасха вечера: зачало 65, от «Сущу позде в день той» до «Не иму веры».",
        }],
    } } });
    else if (gItems.length !== 1 || String(gItems[0].pericopeId) !== String(gospelId)) {
        throw new Error("У Пасхи уже есть другое Евангелие вечерни; нужна сверка");
    }
    const first = memorial.kathisma1?.items ?? [];
    const second = memorial.kathisma2?.items ?? [];
    if (!Array.isArray(first) || !Array.isArray(second)) throw new Error("Неверная структура чтений субботы");
    const isSelected = (i: Document) => String(i.textId) === String(textId);
    if (!first.length && second.filter(isSelected).length === 1) {
        const selected = second.find(isSelected);
        changes.push({ before: memorial, fields: {
            kathisma1: { ...memorial.kathisma1, items: [{ ...selected,
                description: "Златоуст на 1 Кор.15:44: о воскресении и умерших (четья редакция Торжественника, слово101)",
                cite: "Типикон, гл.50: заупокойная суббота по чину мясопустной; гл.49: по обычном стихословии чтутся словеса о мертвых к Коринфяном в 1-м послании. Выбран фрагмент заключительной части беседы41: https://azbyka.ru/otechnik/Ioann_Zlatoust/besedy-na-1-e-poslanie-k-korinfjanam/41 . Типикон не предписывает номер конкретного слова.",
            }] },
            kathisma2: { ...memorial.kathisma2, items: second.filter(i => !isSelected(i)) },
        } });
    } else if (first.length !== 1 || !isSelected(first[0]) || second.some(isSelected)) {
        throw new Error("Чтения субботы изменились; перенос без повторов невозможен");
    }
    console.log(JSON.stringify({ mode: apply ? "apply" : "plan", changes: changes.map(p => ({
        id: String(p.before._id), name: p.before.name, fields: Object.keys(p.fields),
    })) }, null, 2));
    if (!apply || !changes.length) return;
    const dir = join(process.cwd(), "scratch", "triodion-backups");
    await mkdir(dir, { recursive: true });
    const path = join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}-final-gaps.json`);
    await writeFile(path, BSON.EJSON.stringify(changes, undefined, 2), { flag: "wx", mode: 0o600 });
    console.log(`Копия исходных документов: ${path}`);
    for (const p of changes) {
        const filter: Document = { _id: p.before._id };
        for (const k of Object.keys(p.fields)) filter[k] = p.before[k] === undefined ? { $exists: false } : p.before[k];
        const result = await db.collection("days").updateOne(filter, { $set: { ...p.fields, updatedAt: new Date() } });
        if (!result.matchedCount) throw new Error(`Параллельная правка ${p.before.name}; миграция остановлена`);
    }
    console.log("Два места заполнены: одно новое Евангелие и перенос существующего слова на 1 Кор. без дублирования.");
    if (local(process.env.REVALIDATE_URL || "http://localhost:3000")) await revalidateContent();
    else console.warn("Удалённый сброс кэша пропущен: разрешён только локальный сайт.");
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
    .finally(() => client.close());

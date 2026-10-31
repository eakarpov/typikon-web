// Локальная база: план по умолчанию, --apply сохраняет BSON-копию и добавляет 7 назначений.
import "@/scripts/lib/env";
import { BSON, MongoClient, ObjectId, type Document } from "mongodb";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolvePericopeVersesWithFallback } from "@/lib/pericopes";
import { DEFAULT_BIBLE_LANGUAGE } from "@/utils/bibleLanguage";
import { revalidateContent } from "@/scripts/lib/revalidate";

const apply = process.argv.includes("--apply");
const client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 5000 });
const local = (url: string) => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
const equal = (a: unknown, b: unknown) => BSON.EJSON.stringify(a) === BSON.EJSON.stringify(b);
const source = "https://azbyka.ru/otechnik/Pravoslavnoe_Bogosluzhenie/tipikon/50";
const range = (chapter: number, from: number, to: number) => [
    { chapterFrom: chapter, verseFrom: from, chapterTo: chapter, verseTo: to },
];
const additions = [
    { day: "63cd86a0f6bb0f3a9baffee1", slot: "gospelLiturgy", id: "6a820cb93f7812bfa7c4f5b8",
        bookSlug: "luki", number: 113, ranges: range(24, 12, 35), description: "Лк. 113",
        cite: `${source} — Светлый вторник: Евангелие Луки, зачало 113.` },
    { day: "63d17249bec689206fc697fc", slot: "apostleLiturgy", id: "6a820cb93f7812bfa7c4f70a",
        bookSlug: "efesyanam", number: 229, ranges: range(5, 9, 19), description: "Еф. 229",
        cite: `${source} — Понедельник Святого Духа: Апостол ко Ефесеем, зачало 229.` },
    { day: "63d171d3bec689206fc697fa", slot: "gospelLiturgy", id: "6a820cb93f7812bfa7c4f606",
        bookSlug: "ioanna", number: 67, ranges: range(21, 15, 25), description: "Рядовое: Ин. 67",
        cite: "Богослужебное Евангелие, указатель чтений: суббота 7-й седмицы по Пасхе, Ин. 67." },
    { day: "63d171d3bec689206fc697fa", slot: "apostleLiturgy", id: "6a820cb93f7812bfa7c4f735",
        bookSlug: "1-fessaloniyitsam", number: 270, ranges: range(4, 13, 17), description: "За упокой: 1Фес. 270",
        cite: `${source} — Заупокойная суббота, по чину мясопустной: гл. 49, Апостол к Солуняном, зачало 270.` },
    { day: "63d171d3bec689206fc697fa", slot: "gospelLiturgy", id: "6a820cb93f7812bfa7c4f5ca",
        bookSlug: "ioanna", number: 16, ranges: range(5, 24, 30), description: "За упокой: Ин. 16",
        cite: `${source} — Заупокойная суббота, по чину мясопустной (гл. 49). Богослужебное Евангелие: Ин. 16, 5:24–30. В публикации гл. 49 указан номер 17; выбран текст по богослужебному Евангелию.` },
    { day: "63d17059bec689206fc697e2", slot: "song6", id: "63d6fcb7ccb3e32423c34c06",
        bookId: "63cf97b9a0245854ba1d790f", description: "Синаксарий Преполовения",
        cite: `${source} — Преполовение, по 6-й песни: И икос, и синаксарий.` },
    { day: "63d171cfbec689206fc697f4", slot: "before1h", id: "692752de9c79fc672a968300",
        bookId: "63e0a1bd61c39059532d1f2f", description: "Оглашение Студитово в неделю Отцов",
        cite: "Типикон, гл. 2: по исхождении в притвор — оглашение Студитово; гл. 50, правило от Антипасхи. Выбрано имеющееся слово 8 на собор Отцов; номер слова общей нормой не предписан." },
];

async function main() {
    if (!local(process.env.MONGODB_URI!)) throw new Error("Допускается только локальная MongoDB");
    await client.connect();
    const db = client.db("typikon");
    const plans = new Map<string, { before: Document; fields: Document }>();
    for (const spec of additions) {
        const textReading = "bookId" in spec;
        const target = await db.collection(textReading ? "texts" : "pericopes")
            .findOne({ _id: new ObjectId(spec.id) });
        if (!target) throw new Error(`Не найдено чтение ${spec.id}`);
        if (textReading) {
            if (String(target.bookId) !== spec.bookId || target.readiness !== "ready" || !target.content?.trim()) {
                throw new Error(`Не готов ожидаемый текст ${spec.id}`);
            }
        } else {
            if (target.bookSlug !== spec.bookSlug || target.number !== spec.number ||
                target.variant != null || !equal(target.ranges, spec.ranges) ||
                target.source !== (spec.slot === "apostleLiturgy" ? "apostle" : "gospel")) {
                throw new Error(`Зачало ${spec.id} не соответствует проверенному диапазону`);
            }
            const resolved = await resolvePericopeVersesWithFallback(db, target, DEFAULT_BIBLE_LANGUAGE);
            if (!resolved) throw new Error(`Не разрешается зачало ${spec.id}`);
        }
        let plan = plans.get(spec.day);
        if (!plan) {
            const day = await db.collection("days").findOne({ _id: new ObjectId(spec.day) });
            if (!day || day.redirectTo) throw new Error(`Не найден самостоятельный день ${spec.day}`);
            plan = { before: day, fields: {} };
            plans.set(spec.day, plan);
        }
        const field = plan.fields[spec.slot] ?? plan.before[spec.slot];
        if (field != null && (!Array.isArray(field.items))) throw new Error(`Неверная структура ${spec.day}.${spec.slot}`);
        const key = textReading ? "textId" : "pericopeId";
        const matches = (field?.items ?? []).filter((i: Document) => String(i[key]) === spec.id);
        if (matches.length > 1) throw new Error(`Повтор назначения ${spec.id}`);
        if (matches.length) continue;
        plan.fields[spec.slot] = { ...field, items: [...(field?.items ?? []), {
            cite: spec.cite, description: spec.description, paschal: textReading,
            textId: textReading ? new ObjectId(spec.id) : null,
            ...(textReading ? {} : { pericopeId: new ObjectId(spec.id) }),
        }] };
    }
    const changes = [...plans.values()].filter(p => Object.keys(p.fields).length);
    console.log(JSON.stringify({ mode: apply ? "apply" : "plan", changes: changes.map(p => ({
        id: String(p.before._id), name: p.before.name, fields: Object.keys(p.fields),
        added: Object.entries(p.fields).reduce((n, [k, v]) => n + v.items.length - (p.before[k]?.items?.length ?? 0), 0),
    })) }, null, 2));
    if (!apply || !changes.length) return;
    const dir = join(process.cwd(), "scratch", "triodion-backups");
    await mkdir(dir, { recursive: true });
    const path = join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}-pentecostarion.json`);
    await writeFile(path, BSON.EJSON.stringify(changes, undefined, 2), { flag: "wx", mode: 0o600 });
    console.log(`Копия исходных документов: ${path}`);
    for (const plan of changes) {
        const filter: Document = { _id: plan.before._id };
        for (const field of Object.keys(plan.fields)) filter[field] = plan.before[field] === undefined
            ? { $exists: false } : plan.before[field];
        const result = await db.collection("days").updateOne(filter,
            { $set: { ...plan.fields, updatedAt: new Date() } });
        if (!result.matchedCount) throw new Error(`Параллельная правка ${plan.before.name}; миграция остановлена`);
    }
    const added = changes.reduce((total, p) => total + Object.entries(p.fields)
        .reduce((n, [k, v]) => n + v.items.length - (p.before[k]?.items?.length ?? 0), 0), 0);
    console.log(`Добавлено ${added} назначений в ${changes.length} днях. Повтор безопасен.`);
    if (local(process.env.REVALIDATE_URL || "http://localhost:3000")) await revalidateContent();
    else console.warn("Удалённый сброс кэша пропущен: разрешена только локальная база и локальный сайт.");
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
    .finally(() => client.close());

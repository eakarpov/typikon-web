// Привязка памяти корпуса к СУЩЕСТВУЮЩЕЙ записи каталога святых.
//
// ЗАЧЕМ ОТДЕЛЬНО ОТ import-memory-saints.ts. Тот заводит записи из памятей
// Минеи и сам кладёт связь в `provenance`. Но лицо бывает уже в каталоге из
// другого источника (Собор 2000: «Тихон», «Иннокентий Иркутский»), и тогда
// скрипт заведения его пропускает — заводить второго незачем. Память при этом
// остаётся непривязанной, а разбор посвящений читает связь именно из
// `provenance` (build-dedications) — и престол остаётся без святого.
//
// ЧТО ДЕЛАЕТ. Кладёт в запись provenance-строку { table: "memories", id } в
// том же виде, в каком её пишет import-memory-saints.ts: и карточка святого
// (memoriesOfSaint), и разбор престолов (build-dedications) читают её обе.
//
// Запуск:
//   npm run saints:link-memory -- --saint <slug|адрес|id> --memory <memoryId> [--write]
import "@/scripts/lib/env";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { saintIdOf } from "@/lib/saintKey";
import { CHIN_WORDS } from "@/lib/memorySaints";

const arg = (name: string) => {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 ? process.argv[i + 1] : undefined;
};
const WRITE = process.argv.includes("--write");

const main = async () => {
    const saintRef = arg("saint");
    const memoryId = arg("memory");
    if (!saintRef || !memoryId) {
        console.error("нужны --saint <slug|адрес|id> и --memory <memoryId>");
        process.exit(1);
    }

    const key = await saintIdOf(saintRef);
    if (!key) { console.error(`не нашёл святого по «${saintRef}»`); process.exit(1); }

    const db = (await clientPromise).db("typikon");
    const saint = await db.collection("saints").findOne({ _id: new ObjectId(key) }) as any;
    const memory = await db.collection("memories").findOne({ _id: memoryId as any }) as any;
    if (!memory) {
        console.error(`нет памяти «${memoryId}» — выгрузите их: python3 scripts/export_memories.py (typikon-rules), затем npm run memories:import`);
        process.exit(1);
    }

    const prov = (saint.provenance ?? []) as any[];
    if (prov.some((p) => p.table === "memories" && String(p.id) === memoryId)) {
        console.log(`${saint.name} (${saint.slug}) уже связан с ${memoryId}`);
        process.exit(0);
    }

    const entry = {
        table: "memories",
        id: memoryId,
        edition: memory.book ?? null,
        chin: (memory.chin && CHIN_WORDS[memory.chin]) ?? null,
        office: null,
        text: memory.label ?? null,
        url: null,
    };

    console.log(`святой:  ${saint.name} (${saint.slug})`);
    console.log(`память:  ${memory.label} — ${memoryId}`);
    console.log(`чин:     ${entry.chin ?? "—"}`);

    if (!WRITE) {
        console.log("\nэто план. Чтобы записать, добавьте --write");
        process.exit(0);
    }

    await db.collection("saints").updateOne(
        { _id: saint._id },
        { $set: { provenance: [...prov, entry], updatedAt: new Date() } },
    );
    console.log("\nзаписано");
    process.exit(0);
};

main().catch((e) => { console.error(e); process.exit(1); });

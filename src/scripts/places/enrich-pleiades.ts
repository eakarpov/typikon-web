// Места: обогащение из Pleiades (CC BY 3.0). Этап 1, шаг 3 — после enrich-wikidata,
// которое проставляет ключи Pleiades (P1584) сверх тех, что дал OpenBible.
//
// Что делает (@/lib/places/pleiades): у каждой записи с ключом Pleiades имена этого
// источника заменяются целиком именами из дампа — с письмом, транслитерацией,
// языком и годами; периоды этого источника — общими эпохами места; точка
// ставится, только если её не было.
//
// Дампы pleiades-names и pleiades-places (CSV, ~10 МБ) скачиваются в
// script-data/pleiades (каталог в .gitignore) один раз; чтобы обновить, удалите их.
//
// Запуск:  npm run places:enrich-pleiades            # отчёт, ничего не пишет
//          npm run places:enrich-pleiades -- --write # записать
import "@/scripts/lib/env";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { parse } from "csv-parse/sync";
import clientPromise from "@/lib/mongodb";
import { CsvRow, locationFromRow, namesFromRows, periodsFromKeys, pidOf } from "@/lib/places/pleiades";
import { PLACES } from "@/lib/places/schema";

const WRITE = process.argv.includes("--write");
const DIR = path.join(process.cwd(), "script-data", "pleiades");
const DUMPS = "https://atlantides.org/downloads/pleiades/dumps";

const load = async (kind: "names" | "places"): Promise<CsvRow[]> => {
    const file = `pleiades-${kind}-latest.csv.gz`;
    const target = path.join(DIR, file);
    if (!existsSync(target)) {
        mkdirSync(DIR, { recursive: true });
        console.log(`скачиваю ${file}…`);
        const res = await fetch(`${DUMPS}/${file}`);
        if (!res.ok) throw new Error(`${file}: ${res.status}`);
        writeFileSync(target, Buffer.from(await res.arrayBuffer()));
    }
    return parse(gunzipSync(readFileSync(target)).toString("utf8"), { columns: true, skip_empty_lines: true });
};

async function main() {
    const [nameRows, placeRows] = await Promise.all([load("names"), load("places")]);
    const namesByPid = new Map<string, CsvRow[]>();
    for (const row of nameRows) {
        const pid = pidOf(row.pid);
        if (!namesByPid.has(pid)) namesByPid.set(pid, []);
        namesByPid.get(pid)!.push(row);
    }
    const placeByPid = new Map(placeRows.map((row) => [row.id, row]));

    const db = (await clientPromise).db("typikon");
    const places = db.collection(PLACES);
    const rows = await places.find(
        { "externals.source": "pleiades" },
        { projection: { name: 1, names: 1, periods: 1, location: 1, externals: 1 } },
    ).toArray();

    let withNames = 0, namesTotal = 0, withPeriods = 0, located = 0;
    const absent: string[] = [];
    const now = new Date();
    const updates: { _id: any; set: Record<string, any> }[] = [];

    for (const row of rows) {
        const pid = row.externals.find((e: any) => e.source === "pleiades").id as string;
        const place = placeByPid.get(pid);
        if (!place) { absent.push(`${row.name} (${pid})`); continue; }

        const pleiadesNames = namesFromRows(namesByPid.get(pid) ?? []);
        const periods = periodsFromKeys(place.timePeriodsKeys);
        const set: Record<string, any> = {
            names: [...(row.names ?? []).filter((n: any) => n.source !== "pleiades"), ...pleiadesNames],
            periods: [...(row.periods ?? []).filter((p: any) => p.source !== "pleiades"), ...periods],
            updatedAt: now,
        };
        if (pleiadesNames.length) { withNames++; namesTotal += pleiadesNames.length; }
        if (periods.length) withPeriods++;
        const point = !row.location ? locationFromRow(place) : undefined;
        if (point) {
            Object.assign(set, { location: point.location, precision: point.precision, locationSource: "pleiades" });
            located++;
        }
        updates.push({ _id: row._id, set });
    }

    console.log(`\n=== Отчёт ===`);
    console.log(`Записей с ключом Pleiades: ${rows.length}; нет в дампе: ${absent.length}${absent.length ? ` (${absent.join(", ")})` : ""}`);
    console.log(`С именами: ${withNames}, имён всего: ${namesTotal}; с периодами: ${withPeriods}; точка поставлена: ${located}`);
    const sample = updates.find((u) => rows.find((r) => r._id === u._id)?.externals.some((e: any) => e.id === "619103"));
    if (sample) {
        console.log(`Пример — Анкира:`);
        for (const n of sample.set.names.filter((n: any) => n.source === "pleiades")) {
            console.log(`  ${n.name}${n.transliteration ? ` (${n.transliteration})` : ""} [${n.lang}] ${n.from ?? "…"}–${n.to ?? "…"}`);
        }
        console.log(`  периоды: ${sample.set.periods.map((p: any) => p.label).join(", ") || "нет"}`);
    }

    if (!WRITE) {
        console.log(`Ничего не записано. Для записи: --write`);
        process.exit(0);
    }
    for (const u of updates) await places.updateOne({ _id: u._id }, { $set: u.set });
    console.log(`Записано: ${updates.length}`);
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

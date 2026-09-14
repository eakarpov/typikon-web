// Места: карта славянских поселений — в общий указатель. Этап 5.
//
// Прежняя /places/common рисовала 146 поселений и два пути из статических JSON,
// собранных в проекте вручную (теперь src/scripts/places/data). Места там не
// были местами: ни страницы, ни связи с остальным. Скрипт заводит их записями
// `places` с собранием «slavic», точкой, периодом по дате основания и разрушения,
// а пути («Из варяг в греки», «Янтарный путь») — записями рода route с линией.
//
// Уже существующее место (то же имя в пределах десяти километров) не дублируется:
// ему добавляется собрание и период. Повторный прогон узнаёт свои записи по ключу
// slavic-map и ничего не заводит заново.
//
// Запуск:  npm run places:import-slavic            # отчёт
//          npm run places:import-slavic -- --write # записать
import "@/scripts/lib/env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { slugify, uniqueAlias } from "@/lib/news/format";
import { parseSpan } from "@/lib/places/centuries";
import { PLACES } from "@/lib/places/schema";

const WRITE = process.argv.includes("--write");
const DATA = path.join(process.cwd(), "src", "scripts", "places", "data");
const SOURCE = "slavic-map";
const COLLECTION = "slavic";

interface Settlement { name: string; lat: number; lon: number; createdAt: string; destroyedAt: string | null }
interface Route { name: string; coordinates: { lat: number; lon: number }[] }

const distanceKm = ([lon1, lat1]: number[], [lon2, lat2]: number[]) => {
    const r = Math.PI / 180;
    const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2
        + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(a));
};
const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[^а-яa-z]/g, "");

async function main() {
    const settlements: Settlement[] = JSON.parse(readFileSync(path.join(DATA, "slavic-settlements.json"), "utf8"));
    const routes: Route[] = JSON.parse(readFileSync(path.join(DATA, "slavic-routes.json"), "utf8"));

    const db = (await clientPromise).db("typikon");
    const places = db.collection(PLACES);
    const existing = await places.find({}, { projection: { name: 1, slug: 1, location: 1, externals: 1 } }).toArray();
    const taken = new Set<string>(existing.map((p) => p.slug).filter(Boolean));
    const ours = new Map(existing.flatMap((p) => (p.externals ?? [])
        .filter((e: any) => e.source === SOURCE).map((e: any) => [e.id as string, p])));

    const now = new Date();
    const ops: { kind: "create" | "attach" | "known"; name: string; doc?: any; _id?: ObjectId; set?: any }[] = [];
    const unparsed: string[] = [];

    for (const s of settlements) {
        const founded = parseSpan(s.createdAt);
        const destroyed = parseSpan(s.destroyedAt);
        if (!founded) unparsed.push(`${s.name}: «${s.createdAt}»`);
        if (s.destroyedAt && !destroyed) unparsed.push(`${s.name}: «${s.destroyedAt}»`);
        const period = {
            label: "по карте славянских поселений",
            ...(founded ? { from: founded.from } : {}),
            ...(destroyed ? { to: destroyed.to } : {}),
            note: `основано: ${s.createdAt}; ${s.destroyedAt ? `разрушено: ${s.destroyedAt}` : "существует"}`,
            source: SOURCE,
        };
        const point: [number, number] = [s.lon, s.lat];
        const external = { source: SOURCE, id: s.name };

        if (ours.has(s.name)) { ops.push({ kind: "known", name: s.name }); continue; }
        const twin = existing.find((p) => p.location && norm(p.name) === norm(s.name) && distanceKm(p.location.coordinates, point) < 10);
        if (twin) {
            ops.push({ kind: "attach", name: s.name, _id: twin._id, set: { period, external } });
            continue;
        }
        const slug = uniqueAlias(slugify(s.name), taken);
        taken.add(slug);
        ops.push({
            kind: "create",
            name: s.name,
            doc: {
                name: s.name, nameSource: "editor", slug, kind: "settlement",
                ...(s.destroyedAt ? { status: "ruins" } : {}),
                names: [{ name: s.name, lang: "ru", role: "historical", source: SOURCE, ...period.from !== undefined ? { from: period.from } : {}, ...period.to !== undefined ? { to: period.to } : {} }],
                location: { type: "Point", coordinates: point }, locationSource: SOURCE, precision: "approx",
                periods: [period], collections: [COLLECTION], externals: [external],
                published: true, createdAt: now, updatedAt: now,
            },
        });
    }

    for (const r of routes) {
        if (ours.has(r.name)) { ops.push({ kind: "known", name: r.name }); continue; }
        const slug = uniqueAlias(slugify(r.name), taken);
        taken.add(slug);
        ops.push({
            kind: "create",
            name: r.name,
            doc: {
                name: r.name, nameSource: "editor", slug, kind: "route",
                line: { type: "LineString", coordinates: r.coordinates.map((c) => [c.lon, c.lat]) },
                collections: [COLLECTION], externals: [{ source: SOURCE, id: r.name }],
                published: true, createdAt: now, updatedAt: now,
            },
        });
    }

    const count = (k: string) => ops.filter((o) => o.kind === k).length;
    console.log(`\n=== Отчёт ===`);
    console.log(`Поселений: ${settlements.length}, путей: ${routes.length}`);
    console.log(`Заводится: ${count("create")}; совпало с уже известным местом: ${count("attach")} (${ops.filter((o) => o.kind === "attach").map((o) => o.name).join(", ") || "—"}); уже перенесено: ${count("known")}`);
    if (unparsed.length) console.log(`Даты не разобраны:\n  ${unparsed.join("\n  ")}`);

    if (!WRITE) {
        console.log(`Ничего не записано. Для записи: --write`);
        process.exit(0);
    }
    const created = ops.filter((o) => o.kind === "create").map((o) => o.doc);
    if (created.length) await places.insertMany(created);
    for (const o of ops.filter((o) => o.kind === "attach")) {
        await places.updateOne({ _id: o._id }, {
            $addToSet: { collections: COLLECTION, externals: o.set.external },
            $push: { periods: o.set.period },
            $set: { updatedAt: now },
        } as any);
    }
    console.log(`Записано: заведено ${created.length}, дополнено ${count("attach")}`);
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

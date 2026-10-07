// Престолы из «Соборов.ру» в каталог `temples`.
//
// ПОЧЕМУ МОЖНО. «О проекте» Соборов.ру ограничивают только снимки (согласование
// с автором) и требуют гиперссылку на сайт; правами на тексты статей Каталог не
// обладает. Отдельный факт-престол ничей. Поэтому в реестре источников
// (@/utils/templeSources) у Соборов.ру правило `facts`: берём престолы со
// ссылкой на объект, но не тексты и не фотографии.
//
// ПОЧЕМУ НЕ КАРТОЧКАМИ. Обойти 20+ тысяч карточек объектов ради поля
// «Престолы» — долго и грубо. У Соборов.ру есть указатель посвящений
// (/lib/names.php, ~1378 меток) и страница каждой метки (/mapsearch/?altar=N),
// где во встроенном `markers` лежат ВСЕ её объекты с координатами. Обходим метки
// (тысячи страниц), собираем «объект → его престолы», и уже по координатам
// находим наши храмы. Сверено: набор престолов с меток совпадает с явным полем
// «Престолы» на карточке объекта.
//
// КОМУ ЧТО ДОСТАЁТСЯ. Объект sobory привязывается к нашему храму, если они
// ближе RADIUS метров И у объекта есть престол, который храм уже носит по имени
// (или по престолам из имени). Тогда недостающие престолы объекта дописываются
// храму. Имя метки переводится в наш словарь посвящений; святые, которых словарь
// не знает, пропускаются — заводить их надо в словаре, а не здесь.
//
// НАЙДЕННОЕ — НЕ ФАКТ. Всё ложится престолом со статусом `pending`, источником
// `sobory` и ссылкой на объект. Уже стоящие престолы (в том числе выверенные и
// отклонённые человеком) не переписываются: дописываются только недостающие.
//
// Запуск:
//   npm run temples:import-sobory                 # только показать
//   npm run temples:import-sobory -- --write
//   npm run temples:import-sobory -- --write --limit 50
// Ключи: --cache ДИР (по умолчанию временная), --refresh, --delay 1,
//        --radius 300, --json файл.json
import "@/scripts/lib/env";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import clientPromise from "@/lib/mongodb";
import { matchDedication, matchDedications } from "@/utils/dedications";
import { createFetcher } from "@/lib/pilgrimage/net";

const arg = (name: string, fallback: string) => {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : fallback;
};
const flag = (name: string) => process.argv.includes(`--${name}`);

const WRITE = flag("write");
const REFRESH = flag("refresh");
const LIMIT = Number(arg("limit", "0")) || Infinity;
const DELAY_MS = Math.max(0, Number(arg("delay", "1")) * 1000 || 0);
const RADIUS = Number(arg("radius", "300")) || 300;
const CACHE = arg("cache", join(tmpdir(), "sobory-altars"));
const JSON_OUT = arg("json", "");

const NAMES_URL = "https://sobory.ru/lib/names.php";
const altarCache = (id: string) => join(CACHE, `${id}.html`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const { get } = createFetcher({});

/** Скачать страницу, если её нет в кэше; вернуть её текст. */
const page = async (url: string, file: string): Promise<string> => {
    if (!REFRESH && existsSync(file)) return readFileSync(file, "utf8");
    const r = await get(new URL(url));
    if (r.status >= 400) throw new Error(`${url} ответил ${r.status}`);
    writeFileSync(file, r.body);
    await sleep(DELAY_MS);
    return r.body;
};

/** Имя престола метки: ближайшее <strong> перед ссылкой /mapsearch/?altar=N. */
const altarName = (before: string): string => {
    const strongs = [...before.matchAll(/<strong>([\s\S]*?)<\/strong>/gi)];
    return strongs.length
        ? strongs[strongs.length - 1][1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
        : "";
};

/** Наши посвящения для имени метки: точный образец важнее короткой основы. */
const slugsOfAltar = (name: string): string[] => {
    const hits = matchDedications(name).filter((h) => !h.dedication.generic);
    const pattern = hits.filter((h) => h.tier === "pattern");
    return (pattern.length ? pattern : hits).map((h) => h.dedication.slug);
};

interface SoboryObject {
    lat: number;
    lng: number;
    /** Наш ключ престола → имя, как оно выписано у Соборов.ру. */
    altars: Map<string, string>;
    title: string;
}

const main = async () => {
    mkdirSync(CACHE, { recursive: true });

    // ── Указатель меток ──────────────────────────────────────────────────────
    const namesFile = join(CACHE, "_names.html");
    const names = await page(NAMES_URL, namesFile);
    const altarSlugs = new Map<string, { name: string; slugs: string[] }>();
    for (const m of names.matchAll(/mapsearch\/\?altar=(\d+)/g)) {
        const id = m[1];
        if (altarSlugs.has(id)) continue;
        const name = altarName(names.slice(Math.max(0, (m.index ?? 0) - 1200), m.index ?? 0));
        altarSlugs.set(id, { name, slugs: slugsOfAltar(name) });
    }
    const known = [...altarSlugs.values()].filter((a) => a.slugs.length).length;
    console.log(`меток: ${altarSlugs.size}; из них словарь знает ${known}`);

    // ── Объекты со страниц меток ─────────────────────────────────────────────
    const objects = new Map<string, SoboryObject>();
    let done = 0;
    for (const [id, info] of altarSlugs) {
        let html: string;
        try { html = await page(`https://sobory.ru/mapsearch/?altar=${id}`, altarCache(id)); }
        catch (e) { console.error(`  метка ${id}: ${(e as Error).message}`); continue; }
        const m = /var\s+markers\s*=\s*(\[[\s\S]*?\])\s*;/.exec(html);
        if (m) {
            let arr: any[];
            try { arr = JSON.parse(m[1]); } catch { arr = []; }
            for (const o of arr) {
                const url = String(o.url ?? "").replace(/\\\//g, "/");
                const lat = parseFloat(o.lat), lng = parseFloat(o.lng);
                if (!url || !isFinite(lat) || !isFinite(lng)) continue;
                const cur = objects.get(url) ?? { lat, lng, altars: new Map<string, string>(), title: "" };
                for (const s of info.slugs) cur.altars.set(s, info.name);
                if (!cur.title) cur.title = String(o.title ?? "");
                objects.set(url, cur);
            }
        }
        if (++done % 200 === 0) console.log(`  метки: ${done}/${altarSlugs.size}, объектов: ${objects.size}`);
    }
    console.log(`объектов собрано: ${objects.size}`);

    // ── Сопоставление с нашими храмами ───────────────────────────────────────
    const client = await clientPromise;
    const temples = client.db("typikon").collection("temples");
    const docs = await temples.find(
        { country: "RU", latitude: { $type: "number" }, longitude: { $type: "number" } },
        { projection: { _id: 0, slug: 1, name: 1, latitude: 1, longitude: 1, prestoly: 1 } },
    ).toArray();

    const grid = new Map<string, { url: string; o: SoboryObject }[]>();
    for (const [url, o] of objects) {
        const k = Math.round(o.lat / 0.01) + "," + Math.round(o.lng / 0.01);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k)!.push({ url, o });
    }
    const near = (la: number, lo: number) => {
        const out: { url: string; o: SoboryObject; dist: number }[] = [];
        const ci = Math.round(la / 0.01), cj = Math.round(lo / 0.01), span = Math.ceil(RADIUS / 1110) + 1;
        for (let i = ci - span; i <= ci + span; i++) for (let j = cj - span; j <= cj + span; j++) {
            for (const { url, o } of grid.get(i + "," + j) ?? []) {
                const dlat = (o.lat - la) * 111000, dlon = (o.lng - lo) * 111000 * Math.cos((la * Math.PI) / 180);
                const dist = Math.hypot(dlat, dlon);
                if (dist <= RADIUS) out.push({ url, o, dist });
            }
        }
        return out.sort((a, b) => a.dist - b.dist);
    };

    const dedBySlug = new Map((await client.db("typikon").collection("dedications").find({}).toArray())
        .map((d: any) => [d.slug, d]));

    interface Gain { slug: string; name: string; url: string; dist: number; add: { slug: string; name: string }[]; mainKept: boolean }
    const gains: Gain[] = [];
    for (const d of docs as any[]) {
        const existing = d.prestoly ?? [];
        const own = new Set<string>(existing.map((p: any) => p.dedication));
        const parsed = matchDedication(d.name)?.dedication.slug;
        if (parsed) own.add(parsed);
        if (!own.size) continue;
        const best = near(d.latitude, d.longitude).find((c) => [...c.o.altars.keys()].some((s) => own.has(s)));
        if (!best || !best.o.altars.size) continue;
        const have = new Set(existing.map((p: any) => p.dedication));
        const add = [...best.o.altars.entries()]
            .filter(([slug]) => !have.has(slug))
            .map(([slug, name]) => ({ slug, name }));
        if (!add.length) continue;
        gains.push({ slug: d.slug, name: d.name, url: best.url, dist: Math.round(best.dist), add, mainKept: existing.some((p: any) => p.isMain) });
        if (gains.length >= LIMIT) break;
    }

    const totalAdds = gains.reduce((n, g) => n + g.add.length, 0);
    console.log(`\nхрамов с добавкой: ${gains.length}; новых престолов: ${totalAdds}`);
    console.log(`\nпримеры (${Math.min(12, gains.length)}):`);
    for (const g of gains.slice(0, 12)) {
        console.log(`  ${g.slug}  «${g.name}»  +${g.add.map((a) => a.slug).join(", ")}  (${g.dist} м)`);
    }

    if (!WRITE) {
        console.log("\nхолостой прогон — ничего не пишется (--write чтобы записать)");
        if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(gains, null, 2));
        await client.close();
        return;
    }

    // ── Запись ───────────────────────────────────────────────────────────────
    let written = 0, added = 0;
    for (const g of gains) {
        const t = await temples.findOne({ slug: g.slug }, { projection: { prestoly: 1 } });
        if (!t) continue;
        const existing = t.prestoly ?? [];
        // Уже стоящие престолы (в том числе выверенные и отклонённые) хранит
        // `have`: дописываем только недостающие, ничего не переписывая.
        const have = new Set(existing.map((p: any) => p.dedication));
        let hasMain = existing.some((p: any) => p.isMain);
        const now = new Date();
        const push: any[] = [];
        for (const a of g.add) {
            if (have.has(a.slug)) continue;
            const doc = dedBySlug.get(a.slug);
            const isMain = !hasMain;
            if (isMain) hasMain = true;
            push.push({
                dedication: a.slug,
                label: doc?.label ?? a.name,
                isMain,
                kind: doc?.kind,
                memoryIds: (doc?.feasts ?? []).map((f: any) => f.memoryId).filter(Boolean),
                source: "sobory",
                status: "pending",
                confidence: 0.7,
                evidence: { url: `https://sobory.ru${g.url}`, phrase: a.name },
                matchedAt: now,
            });
            have.add(a.slug);
        }
        if (!push.length) continue;
        await temples.updateOne({ slug: g.slug }, { $set: { prestoly: [...existing, ...push] } });
        written++; added += push.length;
    }
    console.log(`\nзаписано: храмов ${written}, престолов ${added}`);
    if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(gains, null, 2));
    await client.close();
};

main().catch((e) => { console.error(e); process.exit(1); });
